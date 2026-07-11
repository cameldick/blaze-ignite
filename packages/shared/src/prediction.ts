/**
 * "Call It" prediction scoring — pure helpers shared by the resolver and tests.
 * Winners bank Oracle points; there is no real-money payout (Thanks are already
 * non-refundable tips to the streamer), so "winning" = points + streak + glory.
 */

/** Base points for a correct call. */
export const ORACLE_BASE_POINTS = 10;

/**
 * Points a participant earns for one resolved prediction. A correct call scores
 * the base plus a high-roller bonus equal to the whole Thanks they staked;
 * a wrong call scores nothing (and resets their streak elsewhere).
 */
export function oraclePoints(correct: boolean, stakeThanks: number): number {
  if (!correct) return 0;
  return ORACLE_BASE_POINTS + Math.max(0, Math.floor(stakeThanks));
}

/**
 * Each option's share of the combined weight (participants + staked Thanks), so
 * high-rollers move the odds. Returns a percentage per option (0 when empty).
 */
export function predictionPct(options: { backers: number; thanksTotal: number }[]): number[] {
  const weights = options.map((o) => o.backers + o.thanksTotal);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return options.map(() => 0);
  return weights.map((w) => (w / total) * 100);
}
