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

/** Full snapshot replayed on overlay (re)connect. */
export const StateSnapshotMsg = z.object({
  type: z.literal("state"),
  goals: z.array(GoalStateMsg),
  wars: z.array(TipWarStateMsg),
  bosses: z.array(BossStateMsg),
  spotlight: SpotlightStateMsg.optional(),
});

export const OverlayMessage = z.discriminatedUnion("type", [
  ThanksAlertMsg,
  GoalStateMsg,
  TipWarStateMsg,
  BossStateMsg,
  SpotlightStateMsg,
  StateSnapshotMsg,
]);
export type OverlayMessage = z.infer<typeof OverlayMessage>;
