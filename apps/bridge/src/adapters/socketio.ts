import { io, type Socket } from "socket.io-client";
import type { ChannelSubscription } from "@blaze-ignite/shared";
import { BaseAdapter } from "./base.js";
import { decodeBlazeEvent } from "./decode.js";
import { config, SUBSCRIBED_EVENT_TYPES } from "../config.js";
import { log } from "../log.js";

/**
 * Preferred adapter: real-time Blaze EventSub over Socket.IO.
 *
 * Confirmed flow (dev.blaze.stream/docs):
 *   io("https://blaze.stream", { path: "/ws", transports: ["websocket"] })
 *   → message with metadata.messageType === "session_welcome" carrying sessionId
 *   → POST {REST}/events/subscriptions { type, version, condition:{channelId}, sessionId }
 *     with the USER token, once per event type
 *   → notifications arrive (metadata.messageType === "notification").
 *
 * Message envelope handling is done by inspecting metadata.messageType, so we are
 * resilient to the exact socket event name. Reconnect/backoff is built into
 * socket.io-client; on reconnect a fresh session_welcome re-triggers subscribe.
 */
export class SocketIoAdapter extends BaseAdapter {
  readonly mode = "socketio" as const;
  private sockets = new Map<string, Socket>();

  async start(sub: ChannelSubscription): Promise<void> {
    if (this.sockets.has(sub.channelId)) return;
    this.setStatus(sub.channelId, { connected: false });

    const socket = io(config.BLAZE_WS_URL, {
      path: config.BLAZE_WS_PATH,
      transports: ["websocket"],
      auth: { token: sub.accessToken },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });

    socket.on("connect", () => log.info("eventsub connected", { channelId: sub.channelId }));

    // Single envelope-aware handler: branch on metadata.messageType regardless of
    // which socket event name carried it.
    const onMessage = (payload: unknown) => {
      const env = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
      const meta = (env.metadata ?? {}) as Record<string, unknown>;
      const messageType = meta.messageType;

      if (messageType === "session_welcome") {
        const inner = (env.payload ?? env) as Record<string, unknown>;
        const sessionId = (inner.sessionId ?? inner.id) as string | undefined;
        this.setStatus(sub.channelId, { connected: true });
        void this.subscribeAll(sub, sessionId);
        return;
      }
      const normalized = decodeBlazeEvent(env, sub.channelId);
      if (normalized) this.emit(normalized);
    };

    socket.on("eventsub", onMessage);
    socket.on("session_welcome", onMessage);
    // Fallback: some servers emit on a generic channel — inspect everything.
    socket.onAny((name, payload) => {
      if (name === "eventsub" || name === "session_welcome" || name === "connect") return;
      if (payload && typeof payload === "object" && "metadata" in (payload as object)) {
        onMessage(payload);
      }
    });

    socket.on("disconnect", (reason) =>
      this.setStatus(sub.channelId, { connected: false, lastError: `disconnect: ${reason}` }),
    );
    socket.on("connect_error", (err) =>
      this.setStatus(sub.channelId, { connected: false, lastError: String(err.message) }),
    );

    this.sockets.set(sub.channelId, socket);
  }

  /** Create one subscription per event type via the REST endpoint. */
  private async subscribeAll(sub: ChannelSubscription, sessionId: string | undefined): Promise<void> {
    for (const type of SUBSCRIBED_EVENT_TYPES) {
      try {
        const res = await fetch(`${config.BLAZE_REST_BASE}/events/subscriptions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${sub.accessToken}`,
            // Every /v1 request also requires the client-id header.
            ...(config.BLAZE_CLIENT_ID ? { "client-id": config.BLAZE_CLIENT_ID } : {}),
          },
          body: JSON.stringify({
            type,
            version: "1",
            condition: { channelId: sub.blazeChannelId },
            sessionId,
          }),
        });
        if (!res.ok) {
          log.warn("subscribe failed", { type, status: res.status, channelId: sub.channelId });
        }
      } catch (err) {
        log.warn("subscribe error", { type, err: String(err) });
      }
    }
    log.info("eventsub subscriptions created", { channelId: sub.channelId, sessionId });
  }

  async stop(channelId: string): Promise<void> {
    const socket = this.sockets.get(channelId);
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      this.sockets.delete(channelId);
    }
    this.statuses.delete(channelId);
  }
}
