import type { Server as IoServer, Socket } from "socket.io";
import { prisma } from "@blaze-ignite/db";
import type { OverlayMessage } from "@blaze-ignite/shared";
import { loadSnapshot } from "./store.js";
import { log } from "./log.js";

const room = (channelId: string) => `channel:${channelId}`;

/**
 * Overlay transport. OBS browser sources connect here over Socket.IO with their
 * channel's `overlayToken`. On (re)connect we replay a full state snapshot so an
 * OBS source refresh restores goal/war/boss progress with no reset.
 */
export class OverlayHub {
  constructor(private readonly io: IoServer) {
    this.io.on("connection", (socket) => void this.onConnection(socket));
  }

  private async onConnection(socket: Socket): Promise<void> {
    const token =
      (socket.handshake.auth?.overlayToken as string | undefined) ??
      (socket.handshake.query?.overlayToken as string | undefined);
    if (!token) {
      socket.disconnect(true);
      return;
    }
    const channel = await prisma.channel.findUnique({ where: { overlayToken: token } });
    if (!channel) {
      log.warn("overlay rejected: unknown token");
      socket.disconnect(true);
      return;
    }
    await socket.join(room(channel.id));
    log.info("overlay connected", { channelId: channel.id });

    // Replay current state immediately.
    const snapshot = await loadSnapshot(channel.id);
    socket.emit("overlay", { type: "state", ...snapshot } satisfies OverlayMessage);
  }

  /** Push a presentation message to every overlay of a channel. */
  broadcast(channelId: string, message: OverlayMessage): void {
    this.io.to(room(channelId)).emit("overlay", message);
  }
}
