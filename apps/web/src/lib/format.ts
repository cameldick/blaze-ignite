/**
 * Pure display helpers (no React / DOM), shared by overlays and the dashboard.
 * Kept dependency-free so they're trivial to unit test.
 */

/** Format a unitless Blaze amount for display (e.g. 1234 → "1,234"). */
export function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Map a `?pos=` value to Tailwind alignment classes for a full-screen flex-row
 * overlay container. Lets each OBS browser source be anchored independently.
 */
const POS: Record<string, string> = {
  "top-left": "items-start justify-start",
  "top-center": "items-start justify-center",
  "top-right": "items-start justify-end",
  "center-left": "items-center justify-start",
  center: "items-center justify-center",
  "center-right": "items-center justify-end",
  "bottom-left": "items-end justify-start",
  "bottom-center": "items-end justify-center",
  "bottom-right": "items-end justify-end",
};

export function posClass(pos: string | null | undefined, fallback: string): string {
  return (pos && POS[pos]) || POS[fallback] || POS["top-center"]!;
}

/** Bare USD string ("$12.34", "<$0.01", "$0.00") for a $BLAZE amount, or "". */
export function usdOnly(amount: number, price: number | null): string {
  if (price == null || !Number.isFinite(amount) || amount < 0) return "";
  const usd = amount * price;
  if (usd > 0 && usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "≈ $12.34" bracket for an amount input (empty when amount ≤ 0). */
export function usdBracket(amount: number, price: number | null): string {
  if (amount <= 0) return "";
  const s = usdOnly(amount, price);
  return s ? `≈ ${s}` : "";
}
