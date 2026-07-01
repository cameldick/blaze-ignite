import { describe, it, expect } from "vitest";
import type { ActionRule, FollowEvent, GiftEvent } from "@blaze-ignite/shared";
import { applyEventAlerts } from "./ruleEngine.js";

function alertRule(on: string[], text?: string): ActionRule {
  return {
    id: `rule-${on.join("-")}`,
    channelId: "chan-1",
    enabled: true,
    priority: 10,
    match: {},
    action: {
      type: "alert",
      theme: "ignite-dark",
      animation: "pop",
      durationSec: 6,
      on: on as ("thanks" | "follow" | "subscription" | "gift")[],
      text,
    },
  };
}

const follow: FollowEvent = {
  kind: "follow",
  sourceEventId: "f-1",
  channelId: "chan-1",
  occurredAt: "2026-05-04T12:00:00.000Z",
  actor: { id: "u1", username: "alex", displayName: "Alex" },
};

const gift: GiftEvent = {
  kind: "gift",
  sourceEventId: "g-1",
  channelId: "chan-1",
  occurredAt: "2026-05-04T12:00:00.000Z",
  actor: { id: "u1", username: "alex", displayName: "Alex" },
  amount: 5,
};

describe("applyEventAlerts", () => {
  it("fires a follow alert with a rendered {name} headline", () => {
    const msgs = applyEventAlerts(follow, [alertRule(["follow"], "🎉 {name} followed!")]);
    expect(msgs).toHaveLength(1);
    const m = msgs[0]!;
    expect(m.type).toBe("alert");
    if (m.type === "alert") {
      expect(m.eventKind).toBe("follow");
      expect(m.headline).toBe("🎉 Alex followed!");
      expect(m.amount).toBeUndefined();
    }
  });

  it("does not fire when the rule's `on` excludes the event kind", () => {
    const msgs = applyEventAlerts(follow, [alertRule(["subscription"], "hi")]);
    expect(msgs).toHaveLength(0);
  });

  it("renders {amount} and includes the count for a gift", () => {
    const msgs = applyEventAlerts(gift, [alertRule(["gift"], "{name} gifted {amount} subs")]);
    const m = msgs[0]!;
    if (m.type === "alert") {
      expect(m.headline).toBe("Alex gifted 5 subs");
      expect(m.amount).toBe(5);
    }
  });

  it("ignores non-alert rules", () => {
    const goalRule: ActionRule = {
      id: "g",
      channelId: "chan-1",
      enabled: true,
      priority: 10,
      match: {},
      action: { type: "goal", goalId: "goal-1" },
    };
    expect(applyEventAlerts(follow, [goalRule])).toHaveLength(0);
  });
});
