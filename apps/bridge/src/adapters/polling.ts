import type { ChannelSubscription } from "@blaze-ignite/shared";
import { BaseAdapter } from "./base.js";
import { decodeBlazeEvent } from "./decode.js";
import { config } from "../config.js";
import { log } from "../log.js";

/**
 * Fallback adapter: poll the Blaze REST activity feed on an interval.
 *
 * FoxBot ships exactly this ("polling-based listener … WebSocket upgrades
 * planned"), so it is a proven-acceptable path. We page from the last-seen
 * cursor; downstream idempotency dedupe makes overlapping windows harmless.
 *
 * The exact activity endpoint/params are unconfirmed (Day-1 spike). Decoding is
 * delegated to `decodeBlazeEvent`; only the fetch URL/cursor handling is here.
 */
export class PollingAdapter extends BaseAdapter {
  readonly mode = "polling" as const;
  private timers = new Map<string, NodeJS.Timeout>();
  private cursors = new Map<string, string | undefined>();

  async start(sub: ChannelSubscription): Promise<void> {
    if (this.timers.has(sub.channelId)) return;
    this.setStatus(sub.channelId, { connected: true });
    // Kick once immediately, then on an interval.
    void this.poll(sub);
    const timer = setInterval(() => void this.poll(sub), config.POLLING_INTERVAL_MS);
    this.timers.set(sub.channelId, timer);
    log.info("polling adapter started", {
      channelId: sub.channelId,
      intervalMs: config.POLLING_INTERVAL_MS,
    });
  }

  private async poll(sub: ChannelSubscription): Promise<void> {
    const cursor = this.cursors.get(sub.channelId);
    // GET /v1/channels/activities — channel is derived from the access token.
    const url = new URL(`${config.BLAZE_REST_BASE}/channels/activities`);
    url.searchParams.set("limit", "50");
    if (cursor) url.searchParams.set("after", cursor);

    try {
      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${sub.accessToken}`,
          ...(config.BLAZE_CLIENT_ID ? { "client-id": config.BLAZE_CLIENT_ID } : {}),
        },
      });
      if (!res.ok) {
        this.setStatus(sub.channelId, { connected: false, lastError: `HTTP ${res.status}` });
        return;
      }
      const body = (await res.json()) as { data?: unknown[]; cursor?: string; next?: string };
      const items = Array.isArray(body.data) ? body.data : [];
      // Oldest-first so events emit in chronological order.
      for (const item of items.slice().reverse()) {
        if (item && typeof item === "object") {
          const normalized = decodeBlazeEvent(item as Record<string, unknown>, sub.channelId);
          if (normalized) this.emit(normalized);
        }
      }
      const nextCursor = body.cursor ?? body.next;
      if (nextCursor) this.cursors.set(sub.channelId, nextCursor);
      this.setStatus(sub.channelId, { connected: true, lastError: undefined });
    } catch (err) {
      this.setStatus(sub.channelId, { connected: false, lastError: String(err) });
    }
  }

  async stop(channelId: string): Promise<void> {
    const timer = this.timers.get(channelId);
    if (timer) clearInterval(timer);
    this.timers.delete(channelId);
    this.cursors.delete(channelId);
    this.statuses.delete(channelId);
  }
}
