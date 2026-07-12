import { z } from "zod";
import { MarketTickMsg, MARKET_BASELINE, momentumDecay, marketOutcome, marketSplit } from "@blaze-ignite/shared";

type MarketMsg = z.infer<typeof MarketTickMsg>;
import type { OverlayHub } from "./overlayHub.js";
import { awardOracle, loadOracle } from "./store.js";
import { log } from "./log.js";

/** Tuning. Weights are how much each real event pushes the momentum index. */
const TICK_MS = 1500;
const DECAY = 0.9; // per-tick pull toward baseline
const HISTORY = 48; // rolling points kept for the sparkline
const THANKS_WEIGHT = 4;
const VOTE_WEIGHT = 6;
const CHAT_WEIGHT = 2;
const SETTLED_LINGER_MS = 12_000; // how long the result stays on screen

interface Position {
  side: "long" | "short";
  stake: number;
  name: string;
}

interface Round {
  entryIndex: number;
  closesAt: number; // epoch ms
  positions: Map<string, Position>; // actorId → position (first pick locks side)
  timer?: NodeJS.Timeout;
}

interface Settled {
  entryIndex: number;
  exitIndex: number;
  outcome: "long" | "short";
  long: { backers: number; thanks: number };
  short: { backers: number; thanks: number };
  winners: { name: string; stakeThanks: number }[];
  clearTimer?: NodeJS.Timeout;
}

interface ChannelMarket {
  index: number;
  history: number[];
  round: Round | null;
  settled: Settled | null;
  /** Skip idle re-broadcasts when nothing meaningful changed. */
  lastSent: number;
}

/**
 * The Stream Market momentum engine. Holds a live, decaying index per channel
 * (in memory — rounds are ephemeral and real-time; only Oracle P&L is persisted)
 * and pushes throttled ticks to overlays. One shared ticker drives every active
 * channel.
 */
export class MarketEngine {
  private ch = new Map<string, ChannelMarket>();
  private ticker?: NodeJS.Timeout;

  constructor(private readonly overlay: OverlayHub) {}

  start(): void {
    if (!this.ticker) this.ticker = setInterval(() => this.tickAll(), TICK_MS);
  }

  stop(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = undefined;
  }

  private get(channelId: string): ChannelMarket {
    let m = this.ch.get(channelId);
    if (!m) {
      m = { index: MARKET_BASELINE, history: [MARKET_BASELINE], round: null, settled: null, lastSent: MARKET_BASELINE };
      this.ch.set(channelId, m);
    }
    return m;
  }

  // ── event signals (cheap, in-memory) ──────────────────────────────────────
  onThanks(channelId: string, amount: number): void {
    this.get(channelId).index += amount * THANKS_WEIGHT;
    this.broadcast(channelId);
  }
  onVote(channelId: string, amount: number): void {
    this.get(channelId).index += amount * VOTE_WEIGHT;
    this.broadcast(channelId);
  }
  /** Chat is high-volume — bump the index but let the ticker do the broadcast. */
  onChat(channelId: string): void {
    this.get(channelId).index += CHAT_WEIGHT;
  }

  /** Record a LONG/SHORT position (first pick locks the side; same side adds stake). */
  position(channelId: string, actorId: string, name: string, side: "long" | "short" | null, stake: number): void {
    if (!side) return;
    const m = this.get(channelId);
    if (!m.round) return;
    const existing = m.round.positions.get(actorId);
    if (!existing) m.round.positions.set(actorId, { side, stake, name });
    else if (existing.side === side) existing.stake += stake;
    else return; // locked to the other side — ignore
    this.broadcast(channelId);
  }

  // ── round lifecycle ───────────────────────────────────────────────────────
  openRound(channelId: string, durationSec: number): void {
    const m = this.get(channelId);
    if (m.round?.timer) clearTimeout(m.round.timer);
    if (m.settled?.clearTimer) clearTimeout(m.settled.clearTimer);
    m.settled = null;
    const closesAt = Date.now() + durationSec * 1000;
    m.round = { entryIndex: m.index, closesAt, positions: new Map() };
    m.round.timer = setTimeout(() => void this.settle(channelId), durationSec * 1000);
    log.info("market round opened", { channelId, durationSec });
    this.broadcast(channelId, true);
  }

  async settle(channelId: string): Promise<void> {
    const m = this.get(channelId);
    if (!m.round) return;
    if (m.round.timer) clearTimeout(m.round.timer);
    const entryIndex = m.round.entryIndex;
    const exitIndex = m.index;
    const outcome = marketOutcome(entryIndex, exitIndex);
    const positions = [...m.round.positions.entries()].map(([actorId, p]) => ({ actorId, ...p }));
    const winners = positions
      .filter((p) => p.side === outcome)
      .sort((a, b) => b.stake - a.stake)
      .slice(0, 8)
      .map((p) => ({ name: p.name, stakeThanks: p.stake }));

    m.settled = {
      entryIndex,
      exitIndex,
      outcome,
      long: poolOf(positions, "long"),
      short: poolOf(positions, "short"),
      winners,
    };
    m.round = null;

    // Persist P&L to the Oracle leaderboard, then refresh the oracle overlay.
    try {
      await awardOracle(
        channelId,
        positions.map((p) => ({
          actorId: p.actorId,
          actorName: p.name,
          correct: p.side === outcome,
          stakeThanks: p.stake,
        })),
      );
      this.overlay.broadcast(channelId, await loadOracle(channelId));
    } catch (err) {
      log.error("market oracle award failed", { channelId, err: String(err) });
    }
    log.info("market settled", { channelId, outcome, entryIndex, exitIndex, winners: winners.length });
    this.broadcast(channelId, true);
    m.settled.clearTimer = setTimeout(() => {
      const mm = this.get(channelId);
      if (!mm.round) {
        mm.settled = null;
        this.broadcast(channelId, true);
      }
    }, SETTLED_LINGER_MS);
  }

  cancel(channelId: string): void {
    const m = this.get(channelId);
    if (m.round?.timer) clearTimeout(m.round.timer);
    if (m.settled?.clearTimer) clearTimeout(m.settled.clearTimer);
    m.round = null;
    m.settled = null;
    this.broadcast(channelId, true);
  }

  // ── ticking + broadcast ───────────────────────────────────────────────────
  private tickAll(): void {
    for (const [channelId, m] of this.ch) {
      m.index = momentumDecay(m.index, MARKET_BASELINE, DECAY);
      m.history.push(round1(m.index));
      if (m.history.length > HISTORY) m.history.shift();
      // Idle channel (no round/result, resting at baseline) → stop chattering.
      const idle = !m.round && !m.settled && Math.abs(m.index - MARKET_BASELINE) < 0.5;
      if (!idle) this.broadcast(channelId);
    }
  }

  private broadcast(channelId: string, force = false): void {
    const m = this.get(channelId);
    if (!force && Math.abs(m.index - m.lastSent) < 0.01 && !m.round && !m.settled) return;
    m.lastSent = m.index;
    this.overlay.broadcast(channelId, this.toMsg(m));
  }

  private toMsg(m: ChannelMarket): MarketMsg {
    let round: MarketMsg["round"] = null;
    if (m.round) {
      const positions = [...m.round.positions.values()];
      const long = poolOf(positions, "long");
      const short = poolOf(positions, "short");
      const [lp, sp] = marketSplit(long, short);
      round = {
        status: "open",
        entryIndex: round1(m.round.entryIndex),
        closesAt: m.round.closesAt,
        long: { ...long, pct: lp },
        short: { ...short, pct: sp },
      };
    } else if (m.settled) {
      const [lp, sp] = marketSplit(m.settled.long, m.settled.short);
      round = {
        status: "settled",
        entryIndex: round1(m.settled.entryIndex),
        exitIndex: round1(m.settled.exitIndex),
        outcome: m.settled.outcome,
        long: { ...m.settled.long, pct: lp },
        short: { ...m.settled.short, pct: sp },
        winners: m.settled.winners,
      };
    }
    return { type: "market", index: round1(m.index), history: [...m.history], round };
  }
}

function poolOf(positions: Position[], side: "long" | "short") {
  const on = positions.filter((p) => p.side === side);
  return { backers: on.length, thanks: on.reduce((s, p) => s + p.stake, 0) };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
