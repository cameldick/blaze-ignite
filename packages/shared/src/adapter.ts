import type { NormalizedEvent } from "./events.js";

/**
 * EventAdapter contract.
 *
 * The bridge holds one subscription per connected channel. We ship two
 * implementations behind this interface:
 *   - SocketIoAdapter  — preferred, real-time Blaze EventSub over Socket.IO
 *   - PollingAdapter   — fallback (FoxBot proves polling is acceptable upstream)
 *
 * The rest of the system depends ONLY on this interface and on NormalizedEvent,
 * so swapping/adding adapters never touches the rule engine, persistence, or
 * overlays. The adapter owns ALL Blaze-specific decoding.
 */

/** Per-channel credentials/handle the adapter needs to subscribe. */
export interface ChannelSubscription {
  /** Our internal Channel.id — the canonical id stamped on every normalized
   *  event and used everywhere downstream (persistence, overlays, analytics). */
  channelId: string;
  /** Blaze's own channel id — used only for upstream API/subscription calls. */
  blazeChannelId: string;
  /** Decrypted OAuth access token for this channel. */
  accessToken: string;
}

export type AdapterMode = "socketio" | "polling";

export interface AdapterStatus {
  mode: AdapterMode;
  connected: boolean;
  /** ISO-8601 of last successfully received event, if any. */
  lastEventAt?: string;
  lastError?: string;
}

export interface EventAdapter {
  readonly mode: AdapterMode;

  /** Begin delivering normalized events for this channel. */
  start(sub: ChannelSubscription): Promise<void>;

  /** Stop and release the channel's connection/timers. */
  stop(channelId: string): Promise<void>;

  /**
   * Register a handler for normalized events. The adapter guarantees each event
   * carries a stable `sourceEventId`; downstream dedupe relies on it.
   */
  onEvent(handler: (event: NormalizedEvent) => void): void;

  /** Register a connection-status handler (drives the diagnostics page). */
  onStatus(handler: (status: AdapterStatus) => void): void;

  status(channelId: string): AdapterStatus | undefined;
}
