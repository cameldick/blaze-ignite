import { describe, it, expect } from "vitest";
import { NormalizedEvent, isThanks, isVote } from "./events.js";
import { AlertConfig } from "./rules.js";

const base = {
  sourceEventId: "evt-1",
  channelId: "chan-1",
  occurredAt: "2026-05-04T12:00:00.000Z",
};

describe("NormalizedEvent", () => {
  it("parses a thanks event", () => {
    const e = NormalizedEvent.parse({
      ...base,
      kind: "thanks",
      actor: { id: "u1", username: "alex" },
      amount: 100,
      message: "gg",
    });
    expect(isThanks(e)).toBe(true);
    if (isThanks(e)) expect(e.amount).toBe(100);
  });

  it("parses a vote event carrying a wallet address", () => {
    const e = NormalizedEvent.parse({
      ...base,
      kind: "vote",
      actor: { id: "u1", username: "alex", address: "0xabc" },
      amount: 30,
    });
    expect(isVote(e)).toBe(true);
    if (isVote(e)) expect(e.actor.address).toBe("0xabc");
  });

  it("parses a gift event with a count", () => {
    const e = NormalizedEvent.parse({
      ...base,
      kind: "gift",
      actor: { id: "u1", username: "alex" },
      amount: 5,
    });
    expect(e.kind).toBe("gift");
  });

  it("rejects an unknown kind", () => {
    expect(() => NormalizedEvent.parse({ ...base, kind: "nope" })).toThrow();
  });
});

describe("AlertConfig defaults", () => {
  it("defaults `on` to thanks and fills theme/animation/duration", () => {
    const cfg = AlertConfig.parse({ type: "alert" });
    expect(cfg.on).toEqual(["thanks"]);
    expect(cfg.durationSec).toBe(6);
    expect(cfg.animation).toBe("pop");
  });
  it("accepts multiple triggers and a custom message", () => {
    const cfg = AlertConfig.parse({
      type: "alert",
      on: ["follow", "gift"],
      text: "🎉 {name}!",
    });
    expect(cfg.on).toEqual(["follow", "gift"]);
    expect(cfg.text).toBe("🎉 {name}!");
  });
});
