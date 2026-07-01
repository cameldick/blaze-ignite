"use client";

import { useEffect, useState } from "react";

/**
 * Shared $BLAZE→USD price for the dashboard. One fetch is shared across all
 * components via a module cache and refreshed every ~60s.
 */
let cache: { price: number | null; at: number } = { price: null, at: 0 };
let inflight: Promise<void> | null = null;

function refresh(): Promise<void> {
  if (Date.now() - cache.at < 60_000 && cache.price != null) return Promise.resolve();
  if (!inflight) {
    inflight = fetch("/api/blaze-price")
      .then((r) => r.json())
      .then((d: { priceUsd: number | null }) => {
        cache = { price: d.priceUsd ?? null, at: Date.now() };
      })
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useBlazePrice(): number | null {
  const [price, setPrice] = useState<number | null>(cache.price);
  useEffect(() => {
    let alive = true;
    void refresh().then(() => alive && setPrice(cache.price));
    const t = setInterval(() => void refresh().then(() => alive && setPrice(cache.price)), 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return price;
}

// Re-export so existing imports keep working.
export { usdBracket, usdOnly } from "./format";
