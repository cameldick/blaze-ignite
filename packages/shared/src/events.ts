import { z } from "zod";

/**
 * Normalized event model — grounded in Blaze's CONFIRMED EventSub payloads
 * (dev.blaze.stream/docs). Every raw Blaze notification is mapped into one of
 * these by an EventAdapter before it touches the rule engine, overlays, or DB.
 * The adapter is the single insulation layer; if upstream changes, only it does.
 *
 * Reality notes baked in here:
 *  - There is NO "tip" event. `channel.thanks` is the support primitive; its
 *    `amount` is a UNITLESS string ("100") — no currency, no tx hash.
 *  - `channel.vote` (Backstage Voting) carries the voter's wallet `address` and
 *    a numeric weight — the only on-chain identity in any payload.
 */

export const NormalizedEventKind = z.enum([
  "thanks", // channel.thanks — the support/"tip" primitive (unitless amount)
  "vote", // channel.vote — Backstage governance vote (wallet-bearing)
  "subscription", // channel.subscribe
  "gift", // channel.subscription.gift — gifter + giftCount
  "follow", // channel.follow
  "chat", // channel.chat.message — used for free prediction picks (not persisted)
  "stream.online",
  "stream.offline",
]);
export type NormalizedEventKind = z.infer<typeof NormalizedEventKind>;

/** A viewer/actor referenced by an event. */
export const Actor = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  /** On-chain wallet, present on votes. */
  address: z.string().optional(),
});
export type Actor = z.infer<typeof Actor>;

/** Fields shared by every normalized event. */
const eventBase = {
  /**
   * Stable, upstream-provided id (thanksId / messageId / activity id). Used for
   * idempotency: dedupe on (channelId, kind, sourceEventId) so reconnects and
   * polling overlaps never double-fire an action.
   */
  sourceEventId: z.string(),
  channelId: z.string(),
  /** ISO-8601. When it occurred upstream (createdAt), not when we received it. */
  occurredAt: z.string().datetime(),
};

/** channel.thanks — the support/"tip" primitive. Amount is unitless. */
export const ThanksEvent = z.object({
  ...eventBase,
  kind: z.literal("thanks"),
  actor: Actor,
  /** Normalized to a number; Blaze sends a unitless string. No currency. */
  amount: z.number().nonnegative(),
  message: z.string().optional(),
});
export type ThanksEvent = z.infer<typeof ThanksEvent>;

/** channel.vote — Backstage governance vote for the channel this epoch. */
export const VoteEvent = z.object({
  ...eventBase,
  kind: z.literal("vote"),
  actor: Actor, // actor.address carries the voter wallet
  /** Vote weight. */
  amount: z.number().nonnegative(),
});
export type VoteEvent = z.infer<typeof VoteEvent>;

export const SubscriptionEvent = z.object({
  ...eventBase,
  kind: z.literal("subscription"),
  actor: Actor,
  expiresAt: z.string().datetime().optional(),
});
export type SubscriptionEvent = z.infer<typeof SubscriptionEvent>;

/** channel.subscription.gift — someone gifts N subs to the community. */
export const GiftEvent = z.object({
  ...eventBase,
  kind: z.literal("gift"),
  actor: Actor, // the gifter (payload `sender`)
  /** Number of subs gifted (payload `giftCount`). */
  amount: z.number().nonnegative(),
});
export type GiftEvent = z.infer<typeof GiftEvent>;

export const FollowEvent = z.object({
  ...eventBase,
  kind: z.literal("follow"),
  actor: Actor,
});
export type FollowEvent = z.infer<typeof FollowEvent>;

/**
 * channel.chat.message — a chat line. We only use these to let viewers cast a
 * FREE prediction pick (a keyword in the message). Chat is high-volume, so these
 * are never persisted; the bridge drops them unless a prediction is open.
 */
export const ChatEvent = z.object({
  ...eventBase,
  kind: z.literal("chat"),
  actor: Actor,
  message: z.string(),
  isSubscriber: z.boolean().optional(),
  isFollower: z.boolean().optional(),
  isOwner: z.boolean().optional(),
});
export type ChatEvent = z.infer<typeof ChatEvent>;

export const StreamLifecycleEvent = z.object({
  ...eventBase,
  kind: z.enum(["stream.online", "stream.offline"]),
});
export type StreamLifecycleEvent = z.infer<typeof StreamLifecycleEvent>;

export const NormalizedEvent = z.discriminatedUnion("kind", [
  ThanksEvent,
  VoteEvent,
  SubscriptionEvent,
  GiftEvent,
  FollowEvent,
  ChatEvent,
  StreamLifecycleEvent,
]);
export type NormalizedEvent = z.infer<typeof NormalizedEvent>;

/** Type guards. */
export const isThanks = (e: NormalizedEvent): e is ThanksEvent => e.kind === "thanks";
export const isVote = (e: NormalizedEvent): e is VoteEvent => e.kind === "vote";
