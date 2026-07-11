import { describe, it, expect } from "vitest";
import { decodeBlazeEvent } from "./decode.js";

const CH = "internal-channel-id";

/** Envelopes below mirror the documented Blaze EventSub payloads. */

describe("decodeBlazeEvent", () => {
  it("decodes channel.thanks (unitless string amount → number)", () => {
    const raw = {
      metadata: { messageType: "notification", subscriptionType: "channel.thanks" },
      payload: {
        channelId: "blaze-uuid",
        sender: { id: "u1", username: "alex", displayName: "Alex" },
        thanksId: "t-1",
        message: "Thanks for the stream!",
        amount: "100",
        createdAt: "2026-05-04T12:00:00.000Z",
      },
    };
    const e = decodeBlazeEvent(raw, CH);
    expect(e).not.toBeNull();
    expect(e!.kind).toBe("thanks");
    expect(e!.channelId).toBe(CH); // stamped with internal id, not payload.channelId
    expect(e!.sourceEventId).toBe("t-1");
    if (e!.kind === "thanks") {
      expect(e!.amount).toBe(100);
      expect(e!.actor.username).toBe("alex");
    }
  });

  it("decodes channel.chat.message (used for free prediction picks)", () => {
    const raw = {
      metadata: { subscriptionType: "channel.chat.message" },
      payload: {
        channelId: "blaze-uuid",
        sender: { id: "u9", username: "sam", displayName: "Sam", isSubscriber: true },
        messageId: "m-1",
        message: "!yes for sure",
        createdAt: "2026-05-04T12:00:00.000Z",
      },
    };
    const e = decodeBlazeEvent(raw, CH);
    expect(e).not.toBeNull();
    expect(e!.kind).toBe("chat");
    expect(e!.sourceEventId).toBe("m-1");
    if (e!.kind === "chat") {
      expect(e!.message).toBe("!yes for sure");
      expect(e!.actor.username).toBe("sam");
      expect(e!.isSubscriber).toBe(true);
    }
  });

  it("decodes channel.vote with the voter wallet address", () => {
    const raw = {
      metadata: { subscriptionType: "channel.vote" },
      payload: {
        channelId: "blaze-uuid",
        voter: { id: "u1", username: "alex", address: "0x742d" },
        amount: 30,
      },
    };
    const e = decodeBlazeEvent(raw, CH);
    expect(e!.kind).toBe("vote");
    if (e!.kind === "vote") {
      expect(e!.amount).toBe(30);
      expect(e!.actor.address).toBe("0x742d");
    }
  });

  it("decodes channel.subscription.gift (sender + giftCount)", () => {
    const raw = {
      metadata: { subscriptionType: "channel.subscription.gift" },
      payload: {
        channelId: "blaze-uuid",
        sender: { id: "u1", username: "alex" },
        giftCount: 5,
      },
    };
    const e = decodeBlazeEvent(raw, CH);
    expect(e!.kind).toBe("gift");
    if (e!.kind === "gift") expect(e!.amount).toBe(5);
  });

  it("decodes channel.subscribe and channel.follow", () => {
    const sub = decodeBlazeEvent(
      { metadata: { subscriptionType: "channel.subscribe" }, payload: { subscriber: { id: "u1", username: "alex" } } },
      CH,
    );
    expect(sub!.kind).toBe("subscription");
    const follow = decodeBlazeEvent(
      { metadata: { subscriptionType: "channel.follow" }, payload: { follower: { id: "u1", username: "alex" } } },
      CH,
    );
    expect(follow!.kind).toBe("follow");
  });

  it("returns null for unhandled event types", () => {
    expect(
      decodeBlazeEvent({ metadata: { subscriptionType: "channel.raid" }, payload: {} }, CH),
    ).toBeNull();
  });

  it("handles a flat activity item (no envelope)", () => {
    const e = decodeBlazeEvent({ type: "channel.follow", user: { id: "u1", username: "alex" } }, CH);
    expect(e!.kind).toBe("follow");
  });
});
