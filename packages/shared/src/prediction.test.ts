import { describe, it, expect } from "vitest";
import { oraclePoints, predictionPct, ORACLE_BASE_POINTS } from "./prediction.js";

describe("oraclePoints", () => {
  it("scores nothing for a wrong call", () => {
    expect(oraclePoints(false, 100)).toBe(0);
  });

  it("scores the base for a correct free (unstaked) call", () => {
    expect(oraclePoints(true, 0)).toBe(ORACLE_BASE_POINTS);
  });

  it("adds a high-roller bonus equal to the staked Thanks (floored)", () => {
    expect(oraclePoints(true, 25.7)).toBe(ORACLE_BASE_POINTS + 25);
  });

  it("never goes negative on odd input", () => {
    expect(oraclePoints(true, -5)).toBe(ORACLE_BASE_POINTS);
  });
});

describe("predictionPct", () => {
  it("returns all zeros when there is no participation", () => {
    expect(predictionPct([{ backers: 0, thanksTotal: 0 }, { backers: 0, thanksTotal: 0 }])).toEqual([0, 0]);
  });

  it("weights by participants plus staked Thanks", () => {
    // A: 1 backer + 9 thanks = 10; B: 10 backers + 0 = 10 → 50/50.
    const pct = predictionPct([
      { backers: 1, thanksTotal: 9 },
      { backers: 10, thanksTotal: 0 },
    ]);
    expect(pct[0]).toBeCloseTo(50);
    expect(pct[1]).toBeCloseTo(50);
  });

  it("sums to 100 across options", () => {
    const pct = predictionPct([
      { backers: 3, thanksTotal: 0 },
      { backers: 1, thanksTotal: 0 },
    ]);
    expect(pct[0]! + pct[1]!).toBeCloseTo(100);
  });
});
