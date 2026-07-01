"use client";

import { AnimatePresence, motion } from "framer-motion";
import { THEMES, DEFAULT_THEME } from "@blaze-ignite/shared";
import { formatAmount, posClass, type OverlayState } from "@/lib/useOverlaySocket";

/** Truncate a wallet: 0x742d…f44e */
function shortAddr(a?: string): string | undefined {
  if (!a) return undefined;
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/**
 * Backstage Spotlight overlay: live Backstage-vote standing for this epoch.
 * Surfaces Blaze's on-chain governance (wallet-bearing votes) on stream — the
 * genuine, honest on-chain showcase, and a nudge for viewers to vote (which
 * funds the creator's real Spotlight $BLAZE payout).
 */
export function SpotlightWidget({
  state,
  pos,
  theme = DEFAULT_THEME,
}: {
  state: OverlayState;
  pos?: string | null;
  theme?: string;
}) {
  const t = THEMES[theme] ?? THEMES[DEFAULT_THEME]!;
  const s = state.spotlight;

  return (
    <div className={`overlay-root flex h-screen w-screen p-8 ${posClass(pos, "top-right")}`}>
      <div className="flex flex-col items-end gap-3">
      <div
        className="w-[360px] rounded-2xl border px-5 py-4 backdrop-blur"
        style={{ background: t.surface, borderColor: t.accent, color: t.text }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: t.muted }}>
            Backstage Spotlight
          </span>
          <span className="text-2xl font-black tabular-nums" style={{ color: t.accent2 }}>
            {formatAmount(s?.epochTotal ?? 0)}
          </span>
        </div>
        <div className="mt-1 text-xs" style={{ color: t.muted }}>
          votes this epoch
        </div>

        <div className="mt-4 space-y-1.5">
          {(s?.topVoters ?? []).map((v, i) => (
            <div key={`${v.name}-${i}`} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-right font-bold" style={{ color: t.accent }}>
                {i + 1}
              </span>
              <span className="truncate font-medium">{v.name}</span>
              {shortAddr(v.address) && (
                <span className="font-mono text-[10px]" style={{ color: t.muted }}>
                  {shortAddr(v.address)}
                </span>
              )}
              <span className="ml-auto tabular-nums" style={{ color: t.accent2 }}>
                {formatAmount(v.amount)}
              </span>
            </div>
          ))}
          {!s?.topVoters?.length && (
            <div className="text-sm" style={{ color: t.muted }}>
              No votes yet this epoch — mint a Backstage Pass and vote!
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {s?.lastVoter && (
          <motion.div
            key={`${s.lastVoter.name}-${s.epochTotal}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border px-4 py-2 text-sm backdrop-blur"
            style={{ background: t.surface, borderColor: t.accent2, color: t.text }}
          >
            🗳️ {s.lastVoter.name} voted +{formatAmount(s.lastVoter.amount)}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
