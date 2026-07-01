import { describe, it, expect } from "vitest";
import { formatAmount, posClass, usdBracket, usdOnly } from "./format";

describe("formatAmount", () => {
  it("adds thousands separators", () => {
    expect(formatAmount(1234)).toBe("1,234");
    expect(formatAmount(1000000)).toBe("1,000,000");
  });
  it("caps fractional digits at 2", () => {
    expect(formatAmount(12.3456)).toBe("12.35");
  });
});

describe("posClass", () => {
  it("maps a known position to alignment classes", () => {
    expect(posClass("top-left", "top-center")).toBe("items-start justify-start");
    expect(posClass("bottom-right", "top-center")).toBe("items-end justify-end");
    expect(posClass("center", "top-center")).toBe("items-center justify-center");
  });
  it("falls back when pos is null/unknown", () => {
    expect(posClass(null, "bottom-center")).toBe("items-end justify-center");
    expect(posClass("nonsense", "top-right")).toBe("items-start justify-end");
  });
});

describe("usdBracket", () => {
  it("returns empty when price or amount is unusable", () => {
    expect(usdBracket(100, null)).toBe("");
    expect(usdBracket(0, 0.001)).toBe("");
    expect(usdBracket(-5, 0.001)).toBe("");
  });
  it("computes amount × price with 2 decimals", () => {
    expect(usdBracket(1000, 0.002)).toBe("≈ $2.00");
    expect(usdBracket(50, 0.5)).toBe("≈ $25.00");
  });
  it("shows <$0.01 for tiny values", () => {
    expect(usdBracket(1, 0.0001)).toBe("≈ <$0.01");
  });
});

describe("usdOnly", () => {
  it("shows $0.00 for zero (so every number can display USD)", () => {
    expect(usdOnly(0, 0.002)).toBe("$0.00");
  });
  it("formats positive amounts and empty on missing price", () => {
    expect(usdOnly(1000, 0.002)).toBe("$2.00");
    expect(usdOnly(100, null)).toBe("");
  });
});
