import { z } from "zod";

/**
 * Rule model: how a creator maps incoming `channel.thanks` support onto
 * on-stream actions. Rules are authored in the dashboard, stored in Postgres,
 * and hot-reloaded by the bridge's rule engine. (Votes drive the always-on
 * Backstage Spotlight overlay separately, not via these rules.)
 */

/** What an action targets. Each maps to one overlay widget family. */
export const ActionType = z.enum([
  "alert", // animated tip alert (always-on-ish, tier-styled)
  "goal", // contribute the tip amount to a funding goal
  "tipwar", // route the tip as weighted votes to a tip-war option
  "boss", // deal damage to / charge a boss meter
]);
export type ActionType = z.infer<typeof ActionType>;

/**
 * Match conditions for a rule. All present fields must hold (AND). Amount is the
 * unitless `channel.thanks` amount.
 */
export const RuleMatch = z.object({
  /** Inclusive lower bound on amount. */
  minAmount: z.number().nonnegative().optional(),
  /** Inclusive upper bound on amount. */
  maxAmount: z.number().nonnegative().optional(),
});
export type RuleMatch = z.infer<typeof RuleMatch>;

/** Per-action-type configuration payloads. */
/** Which events an alert rule reacts to. */
export const AlertTrigger = z.enum(["thanks", "follow", "subscription", "gift"]);
export type AlertTrigger = z.infer<typeof AlertTrigger>;

export const AlertConfig = z.object({
  type: z.literal("alert"),
  /** Overlay theme id (see shared/themes). */
  theme: z.string().default("ignite-dark"),
  animation: z.enum(["glow", "pulse", "slideIn", "pop"]).default("pop"),
  /** Seconds the alert stays on screen. */
  durationSec: z.number().positive().max(30).default(6),
  /** Event kinds that fire this alert. Defaults to Thanks (back-compat). */
  on: z.array(AlertTrigger).min(1).default(["thanks"]),
  /**
   * Custom on-screen message. Supports {name} and {amount} placeholders.
   * When empty, the overlay shows a default label (e.g. "new follower").
   */
  text: z.string().max(200).optional(),
  /** Optional sound pack id. */
  sound: z.string().optional(),
});

export const GoalConfig = z.object({
  type: z.literal("goal"),
  goalId: z.string(),
});

export const TipWarConfig = z.object({
  type: z.literal("tipwar"),
  warId: z.string(),
  /**
   * Which option this tip funds. When omitted, the viewer chooses via tip
   * message keyword (resolved by the rule engine).
   */
  optionId: z.string().optional(),
});

export const BossConfig = z.object({
  type: z.literal("boss"),
  bossId: z.string(),
  /** Damage dealt per 1 unit of thanks amount. */
  damagePerPoint: z.number().positive().default(10),
});

export const ActionConfig = z.discriminatedUnion("type", [
  AlertConfig,
  GoalConfig,
  TipWarConfig,
  BossConfig,
]);
export type ActionConfig = z.infer<typeof ActionConfig>;

export const ActionRule = z.object({
  id: z.string(),
  channelId: z.string(),
  enabled: z.boolean().default(true),
  /** Lower runs first; ties broken by id. Lets specific tiers pre-empt catch-alls. */
  priority: z.number().int().default(100),
  match: RuleMatch.default({}),
  action: ActionConfig,
});
export type ActionRule = z.infer<typeof ActionRule>;
