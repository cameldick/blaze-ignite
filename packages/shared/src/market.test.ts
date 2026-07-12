import { describe, it, expect } from "vitest";
import {
  momentumDecay,
  marketOutcome,
  marketSplit,
  sideFromMessage,
  MARKET_BASELINE,
} from "./market.js";

describe("momentumDecay", () => {
  it("pulls the index toward the baseline", () => {
    const next = momentumDecay(2000, MARKET_BASELINE, 0.9);
    expect(next).toBeLessThan(2000);
    expect(next).toBeGreaterThan(MARKET_BASELINE);
    expect(next).toBeCloseTo(1900);
  });
  it("leaves an at-baseline index unchanged", () => {
    expect(momentumDecay(MARKET_BASELINE)).toBeCloseTo(MARKET_BASELINE);
  });
  it("lifts a below-baseline index back up toward baseline", () => {
    // decay 0.9 keeps 90% of the gap, so 500 → 1000 + (500-1000)*0.9 = 550.
    const next = momentumDecay(500, MARKET_BASELINE, 0.9);
    expect(next).toBeCloseTo(550);
    expect(next).toBeGreaterThan(500);
    expect(next).toBeLessThan(MARKET_BASELINE);
  });
});

describe("marketOutcome", () => {
  it("LONG wins when the index rose", () => {
    expect(marketOutcome(1000, 1200)).toBe("long");
  });
  it("SHORT wins when the index fell", () => {
    expect(marketOutcome(1200, 1000)).toBe("short");
  });
  it("a flat market resolves LONG (bullish default)", () => {
    expect(marketOutcome(1000, 1000)).toBe("long");
  });
});

describe("marketSplit", () => {
  it("is even with no positions", () => {
    expect(marketSplit({ backers: 0, thanks: 0 }, { backers: 0, thanks: 0 })).toEqual([50, 50]);
  });
  it("weights by participants plus staked Thanks", () => {
    const [l, s] = marketSplit({ backers: 1, thanks: 9 }, { backers: 10, thanks: 0 });
    expect(l).toBeCloseTo(50);
    expect(s).toBeCloseTo(50);
  });
});

describe("sideFromMessage", () => {
  it("reads long/short keywords", () => {
    expect(sideFromMessage("!long lets go")).toBe("long");
    expect(sideFromMessage("SHORT it")).toBe("short");
    expect(sideFromMessage("to the moon")).toBe("long");
    expect(sideFromMessage("rug incoming")).toBe("short");
  });
  it("returns null when neither side is named", () => {
    expect(sideFromMessage("hello chat")).toBeNull();
    expect(sideFromMessage(undefined)).toBeNull();
  });
});
