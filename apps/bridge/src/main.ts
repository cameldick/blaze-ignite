import { createServer } from "node:http";
import { Server as IoServer } from "socket.io";
import { config } from "./config.js";
import { log } from "./log.js";
import { createAdapter } from "./adapters/factory.js";
import { OverlayHub } from "./overlayHub.js";
import { ChannelManager } from "./channelManager.js";
import { createControlApp } from "./controlServer.js";

/**
 * Bridge entrypoint. One always-on process that:
 *   - exposes the internal control API (web → bridge)
 *   - runs the Socket.IO overlay hub (bridge → OBS overlays)
 *   - holds one Blaze event subscription per channel and runs the pipeline
 */
async function main() {
  const httpServer = createServer();

  // Overlay transport. Auth is the per-channel overlayToken (checked in the hub),
  // so a permissive CORS origin is acceptable here.
  const io = new IoServer(httpServer, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
  });
  const overlay = new OverlayHub(io);

  const adapter = createAdapter();
  const manager = new ChannelManager(adapter, overlay);

  // Mount the control API for all non-Socket.IO requests on the same server.
  // Socket.IO intercepts its own /socket.io/* paths; everything else hits express.
  httpServer.on("request", createControlApp(manager));

  await manager.startAll();

  // Hosts like Render/Railway assign the port via $PORT; fall back to BRIDGE_PORT.
  const port = Number(process.env.PORT) || config.BRIDGE_PORT;
  httpServer.listen(port, () => {
    log.info("bridge listening", { port, adapter: adapter.mode });
  });

  const shutdown = async (sig: string) => {
    log.info("shutting down", { sig });
    io.close();
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log.error("fatal", { err: String(err) });
  process.exit(1);
});
