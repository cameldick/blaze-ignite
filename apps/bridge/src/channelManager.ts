import type { EventAdapter, NormalizedEvent, ActionRule } from "@blaze-ignite/shared";
import type { OverlayHub } from "./overlayHub.js";
import { applyThanks, applyEventAlerts } from "./ruleEngine.js";
import {
  loadChannelIds,
  loadChannelFresh,
  loadRules,
  loadSnapshot,
  loadSpotlight,
  persistEvent,
} from "./store.js";
import { log } from "./log.js";

/**
 * Orchestrates the per-channel pipeline:
 *   adapter event → idempotent persist → rule engine → overlay broadcast.
 *
 * One adapter instance serves all channels; the manager dispatches by the
 * internal channelId stamped on each normalized event.
 */
export class ChannelManager {
  private rulesCache = new Map<string, ActionRule[]>();
  private active = new Set<string>();
  private refreshTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly adapter: EventAdapter,
    private readonly overlay: OverlayHub,
  ) {
    this.adapter.onEvent((e) => void this.handleEvent(e));
    this.adapter.onStatus((s) =>
      log.info("adapter status", { ...s } as Record<string, unknown>),
    );
  }

  /** Boot: subscribe every channel. */
  async startAll(): Promise<void> {
    const ids = await loadChannelIds();
    log.info("starting channels", { count: ids.length });
    await Promise.all(ids.map((id) => this.startChannel(id)));
  }

  /** Subscribe one channel by id (refreshing its token first if needed). */
  async startChannel(channelId: string): Promise<void> {
    const channel = await loadChannelFresh(channelId);
    if (!channel) return;
    this.active.add(channelId);
    this.rulesCache.set(channelId, await loadRules(channelId));
    await this.adapter.start({
      channelId: channel.channelId,
      blazeChannelId: channel.blazeChannelId,
      accessToken: channel.accessToken,
    });
    this.scheduleTokenRefresh(channelId, channel.tokenExpiresAt);
  }

  async stopChannel(channelId: string): Promise<void> {
    const timer = this.refreshTimers.get(channelId);
    if (timer) clearTimeout(timer);
    this.refreshTimers.delete(channelId);
    await this.adapter.stop(channelId);
    this.active.delete(channelId);
    this.rulesCache.delete(channelId);
  }

  /**
   * Schedule a re-subscribe shortly before the OAuth token expires. Blaze user
   * tokens last ~24h; reconnecting with a freshly-refreshed token keeps the
   * event stream alive indefinitely without any user action or random drop.
   */
  private scheduleTokenRefresh(channelId: string, expiresAt: Date | null): void {
    const existing = this.refreshTimers.get(channelId);
    if (existing) clearTimeout(existing);
    if (!expiresAt) return; // no expiry info → nothing to schedule
    const lead = 2 * 60_000; // reconnect 2 min before expiry
    const delay = Math.min(
      Math.max(expiresAt.getTime() - Date.now() - lead, 30_000),
      2_147_000_000, // setTimeout max
    );
    this.refreshTimers.set(
      channelId,
      setTimeout(() => void this.resubscribe(channelId), delay),
    );
  }

  /** Reconnect a channel with a fresh token (fired by the refresh timer). */
  private async resubscribe(channelId: string): Promise<void> {
    if (!this.active.has(channelId)) return;
    log.info("token nearing expiry — refreshing + resubscribing", { channelId });
    try {
      await this.adapter.stop(channelId);
      await this.startChannel(channelId); // loadChannelFresh refreshes + reschedules
    } catch (err) {
      log.error("resubscribe failed; retrying in 60s", { channelId, err: String(err) });
      this.refreshTimers.set(
        channelId,
        setTimeout(() => void this.resubscribe(channelId), 60_000),
      );
    }
  }

  /** Hot-reload a channel's rules (called by the web app after edits). */
  async reloadRules(channelId: string): Promise<void> {
    this.rulesCache.set(channelId, await loadRules(channelId));
    log.info("rules reloaded", { channelId });
  }

  /** Re-broadcast a fresh state snapshot so overlays reflect config changes live. */
  async refreshOverlays(channelId: string): Promise<void> {
    const snapshot = await loadSnapshot(channelId);
    this.overlay.broadcast(channelId, { type: "state", ...snapshot });
  }

  /**
   * Broadcast a one-off alert built directly from a config (dashboard Preview).
   * Bypasses rules/persistence so it shows the exact card being edited, even if
   * it hasn't been saved yet.
   */
  previewAlert(
    channelId: string,
    cfg: {
      eventKind: "thanks" | "follow" | "subscription" | "gift";
      text?: string;
      theme: string;
      animation: "glow" | "pulse" | "slideIn" | "pop";
      durationSec: number;
      actorName?: string;
      amount?: number;
    },
  ): void {
    const name = cfg.actorName ?? "Supporter";
    const headline = cfg.text
      ? cfg.text.replace(/\{name\}/g, name).replace(/\{amount\}/g, cfg.amount != null ? String(cfg.amount) : "")
      : undefined;
    this.overlay.broadcast(channelId, {
      type: "alert",
      eventKind: cfg.eventKind,
      headline,
      actorName: name,
      amount: cfg.eventKind === "thanks" || cfg.eventKind === "gift" ? (cfg.amount ?? 5) : undefined,
      theme: cfg.theme,
      animation: cfg.animation,
      durationSec: cfg.durationSec,
    });
  }

  /**
   * Inject a fabricated event (dashboard "Test Event"); same pipeline, no
   * persist. In preview mode only alerts fire — goal/boss/war state is untouched.
   */
  async injectTest(event: NormalizedEvent, preview = false): Promise<void> {
    await this.dispatch(event, preview);
  }

  private async handleEvent(event: NormalizedEvent): Promise<void> {
    try {
      const { isNew } = await persistEvent(event);
      log.info("event received", {
        kind: event.kind,
        actor: "actor" in event ? event.actor.username : undefined,
        amount: "amount" in event ? event.amount : undefined,
        isNew,
      });
      if (!isNew) return; // idempotency: already processed this sourceEventId
      await this.dispatch(event);
    } catch (err) {
      log.error("handleEvent failed", { kind: event.kind, err: String(err) });
    }
  }

  private async dispatch(event: NormalizedEvent, preview = false): Promise<void> {
    // channel.vote → refresh the always-on Backstage Spotlight overlay.
    if (event.kind === "vote") {
      const spotlight = await loadSpotlight(event.channelId);
      this.overlay.broadcast(event.channelId, {
        ...spotlight,
        lastVoter: {
          name: event.actor.displayName ?? event.actor.username,
          address: event.actor.address,
          amount: event.amount,
        },
      });
      return;
    }
    // Load rules (cached) for the channel.
    if (
      event.kind !== "thanks" &&
      event.kind !== "follow" &&
      event.kind !== "subscription" &&
      event.kind !== "gift"
    )
      return;
    let rules = this.rulesCache.get(event.channelId);
    if (!rules) {
      rules = await loadRules(event.channelId);
      this.rulesCache.set(event.channelId, rules);
    }

    const messages =
      event.kind === "thanks"
        ? await applyThanks(event, rules, preview)
        : applyEventAlerts(event, rules); // follow / subscription / gift → alert only
    for (const msg of messages) this.overlay.broadcast(event.channelId, msg);
  }

  status(channelId: string) {
    return this.adapter.status(channelId);
  }
}
