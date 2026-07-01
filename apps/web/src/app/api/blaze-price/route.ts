import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * $BLAZE → USD price. Blaze's own API exposes no price, so we read the on-chain
 * DEX price from DexScreener (BLAZE token on Avalanche). Cached ~60s in memory.
 * A manual BLAZE_USD_PRICE env value overrides/fallbacks if the fetch fails.
 */
const BLAZE_TOKEN = "0x297731eb3cab3834525fc9ea061fd71d8f4645c9"; // Avalanche
const TTL_MS = 60_000;

let cache: { priceUsd: number; source: string; at: number } | null = null;

async function fetchPrice(): Promise<{ priceUsd: number; source: string } | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${BLAZE_TOKEN}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { pairs?: Array<Record<string, unknown>> };
    const pairs = body.pairs ?? [];
    const priced = pairs
      .filter((p) => typeof p.priceUsd === "string" && Number(p.priceUsd) > 0)
      .sort((a, b) => {
        const la = (a.liquidity as { usd?: number } | undefined)?.usd ?? 0;
        const lb = (b.liquidity as { usd?: number } | undefined)?.usd ?? 0;
        return lb - la;
      });
    const best = priced[0];
    if (!best) return null;
    return { priceUsd: Number(best.priceUsd), source: `dexscreener:${String(best.dexId)}` };
  } catch {
    return null;
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ priceUsd: cache.priceUsd, source: cache.source });
  }
  const fresh = await fetchPrice();
  if (fresh) {
    cache = { ...fresh, at: Date.now() };
    return NextResponse.json({ priceUsd: fresh.priceUsd, source: fresh.source });
  }
  // Fallbacks: last cached value, then an optional manual override.
  if (cache) return NextResponse.json({ priceUsd: cache.priceUsd, source: `${cache.source} (stale)` });
  const manual = Number(process.env.BLAZE_USD_PRICE);
  if (Number.isFinite(manual) && manual > 0) {
    return NextResponse.json({ priceUsd: manual, source: "manual" });
  }
  return NextResponse.json({ priceUsd: null, source: "unavailable" }, { status: 200 });
}
