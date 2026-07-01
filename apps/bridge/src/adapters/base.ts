import type {
  AdapterStatus,
  ChannelSubscription,
  EventAdapter,
  NormalizedEvent,
} from "@blaze-ignite/shared";

/**
 * Shared adapter plumbing: handler registration + per-channel status tracking.
 * Concrete adapters implement only `connect`/`disconnect` and call `emit`.
 */
export abstract class BaseAdapter implements EventAdapter {
  abstract readonly mode: "socketio" | "polling";

  private eventHandler?: (event: NormalizedEvent) => void;
  private statusHandler?: (status: AdapterStatus) => void;
  protected statuses = new Map<string, AdapterStatus>();

  onEvent(handler: (event: NormalizedEvent) => void): void {
    this.eventHandler = handler;
  }
  onStatus(handler: (status: AdapterStatus) => void): void {
    this.statusHandler = handler;
  }
  status(channelId: string): AdapterStatus | undefined {
    return this.statuses.get(channelId);
  }

  protected emit(event: NormalizedEvent): void {
    const s = this.statuses.get(event.channelId);
    if (s) s.lastEventAt = new Date().toISOString();
    this.eventHandler?.(event);
  }

  protected setStatus(channelId: string, patch: Partial<AdapterStatus>): void {
    const prev = this.statuses.get(channelId) ?? { mode: this.mode, connected: false };
    const next: AdapterStatus = { ...prev, ...patch, mode: this.mode };
    this.statuses.set(channelId, next);
    this.statusHandler?.(next);
  }

  abstract start(sub: ChannelSubscription): Promise<void>;
  abstract stop(channelId: string): Promise<void>;
}
