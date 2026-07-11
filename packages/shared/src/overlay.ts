import { z } from "zod";

/**
 * Overlay wire protocol: messages the bridge pushes over WebSocket to OBS
 * browser-source overlays. Presentation-ready, channel-scoped, no upstream
 * coupling. Amounts are unitless (Blaze `channel.thanks`/`channel.vote` carry no
 * currency), so the UI formats the number and labels it neutrally.
 *
 * On (re)connect the bridge sends a `state` snapshot so an OBS source refresh
 * restores goal/war/boss/spotlight progress with no reset.
 */

/** An alert overlay — fired by a Thanks, follow, or subscription. */
export const ThanksAlertMsg = z.object({
  type: z.literal("alert"),
  /** What triggered this alert; drives the label + whether an amount shows. */
  eventKind: z.enum(["thanks", "follow", "subscription", "gift"]).default("thanks"),
  /** Rendered custom message (placeholders already substituted), if configured. */
  headline: z.string().optional(),
  actorName: z.string(),
  actorAvatar: z.string().url().optional(),
  /** Present only for Thanks (unitless). */
  amount: z.number().optional(),
  message: z.string().optional(),
  theme: z.string(),
  animation: z.enum(["glow", "pulse", "slideIn", "pop"]),
  durationSec: z.number(),
  /** Alert text size in px. */
  fontSize: z.number().optional(),
  /** Alert sound (data URL or plain URL) to play when the alert appears. */
  sound: z.string().optional(),
  /** Playback volume 0–100 for the alert sound. */
  volume: z.number().optional(),
});

export const GoalStateMsg = z.object({
  type: z.literal("goal"),
  goalId: z.string(),
  title: z.string(),
  current: z.number(),
  target: z.number(),
  /** Set on the contribution that just landed, for a pop animation. */
  lastContributor: z.string().optional(),
});

export const TipWarStateMsg = z.object({
  type: z.literal("tipwar"),
  warId: z.string(),
  title: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string(), total: z.number() })),
});

export const BossStateMsg = z.object({
  type: z.literal("boss"),
  bossId: z.string(),
  name: z.string(),
  hp: z.number(),
  maxHp: z.number(),
  lastHit: z.object({ actorName: z.string(), damage: z.number() }).optional(),
  defeated: z.boolean().default(false),
});

/**
 * Backstage Spotlight: live Backstage-vote standing for this epoch. Surfaces
 * Blaze's on-chain governance (wallet-bearing votes) on stream — something Blaze
 * shows only on its website, never as an overlay.
 */
export const SpotlightStateMsg = z.object({
  type: z.literal("spotlight"),
  epochTotal: z.number(),
  /** Top voters this epoch (wallet truncated by the UI). */
  topVoters: z.array(
    z.object({ name: z.string(), address: z.string().optional(), amount: z.number() }),
  ),
  /** The vote that just landed, for a celebratory pop. */
  lastVoter: z
    .object({ name: z.string(), address: z.string().optional(), amount: z.number() })
    .optional(),
});

/**
 * "Call It" prediction. Viewers pick an outcome free via chat or back it with
 * Thanks (high-roller weight). `pct` is each option's share of the combined
 * weight (backers + staked Thanks). On resolve, `winners` names the top correct
 * backers for the on-screen celebration.
 */
export const PredictionStateMsg = z.object({
  type: z.literal("prediction"),
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "locked", "resolved"]),
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      backers: z.number(),
      thanksTotal: z.number(),
      pct: z.number(),
    }),
  ),
  winningOptionId: z.string().optional(),
  winners: z.array(z.object({ name: z.string(), stakeThanks: z.number() })).optional(),
});

/** The "Oracle" leaderboard — best predictors on the channel (points + streak). */
export const OracleStateMsg = z.object({
  type: z.literal("oracle"),
  leaders: z.array(
    z.object({ name: z.string(), points: z.number(), streak: z.number(), wins: z.number() }),
  ),
  /** The result that just landed, for a celebratory pop. */
  lastResult: z.object({ name: z.string(), points: z.number(), correct: z.boolean() }).optional(),
});

/** Full snapshot replayed on overlay (re)connect. */
export const StateSnapshotMsg = z.object({
  type: z.literal("state"),
  goals: z.array(GoalStateMsg),
  wars: z.array(TipWarStateMsg),
  bosses: z.array(BossStateMsg),
  spotlight: SpotlightStateMsg.optional(),
  prediction: PredictionStateMsg.optional(),
  oracle: OracleStateMsg.optional(),
});

export const OverlayMessage = z.discriminatedUnion("type", [
  ThanksAlertMsg,
  GoalStateMsg,
  TipWarStateMsg,
  BossStateMsg,
  SpotlightStateMsg,
  PredictionStateMsg,
  OracleStateMsg,
  StateSnapshotMsg,
]);
export type OverlayMessage = z.infer<typeof OverlayMessage>;
