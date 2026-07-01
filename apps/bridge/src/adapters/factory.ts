import type { EventAdapter } from "@blaze-ignite/shared";
import { config } from "../config.js";
import { SocketIoAdapter } from "./socketio.js";
import { PollingAdapter } from "./polling.js";

/**
 * Pick the adapter from config. `auto` prefers Socket.IO when an EventSub URL is
 * configured, else falls back to polling. (Runtime auto-failover on socket death
 * is a hardening item; the seam is here.)
 */
export function createAdapter(): EventAdapter {
  // `auto` prefers real-time Socket.IO; polling is the explicit fallback.
  return config.EVENT_ADAPTER_MODE === "polling" ? new PollingAdapter() : new SocketIoAdapter();
}
