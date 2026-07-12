/**
 * "Stream Market" — trade the streamer. A live momentum index rises on real
 * activity (Thanks, votes, chat) and decays toward a baseline when things go
 * quiet. During a round, viewers go LONG or SHORT; at settle, LONG wins if the
 * index finished at/above its entry, SHORT wins if it fell. Winners bank Oracle
 * points — no real-money payout (stakes are non-refundable Thanks to the
 * streamer). Pure, side-effect-free helpers shared by the engine and its tests.
 */

/** Where the index rests with no activity. */
export const MARKET_BASELINE = 1000;

/** One decay step of the index toward the baseline (0<decay<1; higher = slower). */
export function momentumDecay(index: number, baseline = MARKET_BASELINE, decay = 0.9): number {
  return baseline + (index - baseline) * decay;
}

/** LONG wins if the index held or rose over the round; SHORT wins if it fell. */
export function marketOutcome(entryIndex: number, exitIndex: number): "long" | "short" {
  return exitIndex >= entryIndex ? "long" : "short";
}

/**
 * Each side's share of the pool weight (participants + staked Thanks). With no
 * positions the book is even (50/50), which reads better than 0/0 on screen.
 */
export function marketSplit(
  long: { backers: number; thanks: number },
  short: { backers: number; thanks: number },
): [number, number] {
  const lw = long.backers + long.thanks;
  const sw = short.backers + short.thanks;
  const total = lw + sw;
  if (total <= 0) return [50, 50];
  return [(lw / total) * 100, (sw / total) * 100];
}

/** Map a chat/Thanks message to a market side, or null if it names neither. */
export function sideFromMessage(message: string | undefined): "long" | "short" | null {
  const t = (message ?? "").toLowerCase();
  if (/\b(long|up|bull|moon|pump)\b/.test(t)) return "long";
  if (/\b(short|down|bear|dump|rug)\b/.test(t)) return "short";
  return null;
}
