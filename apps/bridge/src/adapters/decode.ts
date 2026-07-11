import { randomUUID } from "node:crypto";
import { NormalizedEvent, type Actor } from "@blaze-ignite/shared";
import { log } from "../log.js";

/**
 * ⚠️ THE ONE FILE THAT KNOWS BLAZE'S WIRE SHAPE.
 *
 * Confirmed shapes (dev.blaze.stream/docs). Both adapters funnel every raw
 * upstream message through `decodeBlazeEvent`. WebSocket notifications arrive as
 * an envelope; REST activity items arrive flatter — this handles both.
 *
 * WebSocket envelope:
 *   { metadata: { messageType: "notification", subscriptionType: "channel.thanks" },
 *     payload: { channelId, sender|voter|subscriber{...}, amount, message, ... } }
 *
 * channel.thanks payload: sender{id,username,displayName,avatarUrl}, thanksId,
 *   messageId, message, amount:"100" (STRING, unitless), createdAt
 * channel.vote payload:   voter{...,address:"0x.."}, amount:30 (number)
 * channel.subscribe:      subscriber{...,subscribedAt,subscriptionExpiresAt}
 */

type Raw = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const toNum = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return 0;
};

/** Map Blaze subscriptionType (or activity type) → our normalized kind. */
function mapKind(rawType: string | undefined): NormalizedEvent["kind"] | undefined {
  switch ((rawType ?? "").toLowerCase()) {
    case "channel.thanks":
    case "thanks":
      return "thanks";
    case "channel.vote":
    case "vote":
      return "vote";
    case "channel.subscribe":
    case "subscribe":
    case "subscription":
      return "subscription";
    case "channel.subscription.gift":
    case "subscription.gift":
    case "gift":
      return "gift";
    case "channel.follow":
    case "follow":
      return "follow";
    case "channel.chat.message":
    case "chat.message":
    case "chat":
      return "chat";
    case "stream.online":
      return "stream.online";
    case "stream.offline":
      return "stream.offline";
    default:
      return undefined;
  }
}

/** Pull the actor object regardless of which key Blaze used. */
function actorFrom(p: Raw): Actor {
  const u = (p.sender ?? p.voter ?? p.subscriber ?? p.follower ?? p.user ?? {}) as Raw;
  return {
    id: str(u.id) ?? "unknown",
    username: str(u.username) ?? "anonymous",
    displayName: str(u.displayName),
    avatarUrl: str(u.avatarUrl),
    address: str(u.address),
  };
}

/**
 * Decode a raw upstream message (envelope or flat activity) into a
 * NormalizedEvent, or null if it is a kind we don't handle / is unparseable.
 * The internal channelId is supplied by the adapter (it owns the mapping).
 */
export function decodeBlazeEvent(raw: Raw, channelId: string): NormalizedEvent | null {
  const metadata = (raw.metadata ?? {}) as Raw;
  const subType = str(metadata.subscriptionType) ?? str(raw.type) ?? str(raw.kind);
  const kind = mapKind(subType);
  if (!kind) return null;

  const p = (raw.payload ?? raw) as Raw;
  const sourceEventId =
    str(p.thanksId) ?? str(p.messageId) ?? str(p.id) ?? str(raw.id) ?? randomUUID();
  const occurredAt =
    str(p.createdAt) ?? str(p.timestamp) ?? str(raw.createdAt) ?? new Date().toISOString();
  const base = { sourceEventId, channelId, occurredAt };

  try {
    switch (kind) {
      case "thanks":
        return NormalizedEvent.parse({
          ...base,
          kind: "thanks",
          actor: actorFrom(p),
          amount: toNum(p.amount),
          message: str(p.message),
        });
      case "vote":
        return NormalizedEvent.parse({
          ...base,
          kind: "vote",
          actor: actorFrom(p),
          amount: toNum(p.amount),
        });
      case "subscription": {
        const sub = (p.subscriber ?? {}) as Raw;
        return NormalizedEvent.parse({
          ...base,
          kind: "subscription",
          actor: actorFrom(p),
          expiresAt: str(sub.subscriptionExpiresAt),
        });
      }
      case "gift":
        return NormalizedEvent.parse({
          ...base,
          kind: "gift",
          actor: actorFrom(p), // gifter is `sender`
          amount: toNum(p.giftCount ?? p.quantity ?? p.count ?? p.amount),
        });
      case "follow":
        return NormalizedEvent.parse({ ...base, kind: "follow", actor: actorFrom(p) });
      case "chat": {
        const u = (p.sender ?? p.user ?? {}) as Raw;
        return NormalizedEvent.parse({
          ...base,
          kind: "chat",
          actor: actorFrom(p),
          message: str(p.message) ?? "",
          isSubscriber: typeof u.isSubscriber === "boolean" ? u.isSubscriber : undefined,
          isFollower: typeof u.isFollower === "boolean" ? u.isFollower : undefined,
          isOwner: typeof u.isOwner === "boolean" ? u.isOwner : undefined,
        });
      }
      default:
        return NormalizedEvent.parse({ ...base, kind });
    }
  } catch (err) {
    log.warn("failed to decode blaze event", { kind, sourceEventId, err: String(err) });
    return null;
  }
}
