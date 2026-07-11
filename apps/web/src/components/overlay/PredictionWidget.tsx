"use client";

import { motion, AnimatePresence } from "framer-motion";
import { THEMES, DEFAULT_THEME } from "@blaze-ignite/shared";
import { formatAmount, posClass, type OverlayState } from "@/lib/useOverlaySocket";

/**
 * "Call It" prediction. Viewers pick free via chat or back a side with Thanks
 * (high-roller weight). Bars show each side's share; on resolve the winning side
 * lights up and the top correct backers get an on-screen shoutout.
 */
export function PredictionWidget({
  state,
  pos,
  theme = DEFAULT_THEME,
}: {
  state: OverlayState;
  pos?: string | null;
  theme?: string;
}) {
  const t = THEMES[theme] ?? THEMES[DEFAULT_THEME]!;
  const p = state.prediction;

  const statusLabel =
    p?.status === "open" ? "🔮 CALL IT" : p?.status === "locked" ? "🔒 LOCKED" : "✅ RESULT";

  return (
    <div className={`overlay-root flex h-screen w-screen p-8 ${posClass(pos, "center")}`}>
      <AnimatePresence mode="wait">
        {p && (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="w-[520px] max-w-full rounded-2xl border px-6 py-5 shadow-2xl backdrop-blur"
            style={{ background: t.surface, borderColor: t.accent, color: t.text, boxShadow: `0 0 40px ${t.accent}55` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.accent }}>
                {statusLabel}
              </span>
              {p.status !== "resolved" && (
                <span className="text-xs" style={{ color: t.muted }}>
                  chat or Thanks a keyword to pick
                </span>
              )}
            </div>
            <div className="mb-4 text-xl font-black leading-tight">{p.title}</div>

            <div className="space-y-3">
              {p.options.map((o, i) => {
                const won = p.status === "resolved" && p.winningOptionId === o.id;
                const lost = p.status === "resolved" && !won;
                const color = i % 2 === 0 ? t.accent : t.accent2;
                return (
                  <div key={o.id} style={{ opacity: lost ? 0.45 : 1 }}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold">
                        {won && "🏆 "}
                        {o.label}
                      </span>
                      <span className="tabular-nums" style={{ color: t.muted }}>
                        {o.backers} {o.backers === 1 ? "pick" : "picks"}
                        {o.thanksTotal > 0 && <> · 💰 {formatAmount(o.thanksTotal)}</>} · {o.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: won ? t.accent2 : color }}
                        initial={false}
                        animate={{ width: `${o.pct}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {p.status === "resolved" && p.winners && p.winners.length > 0 && (
              <div className="mt-4 border-t pt-3" style={{ borderColor: `${t.accent}33` }}>
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: t.accent2 }}>
                  🎉 Called it
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {p.winners.map((w, i) => (
                    <span key={i}>
                      {w.name}
                      {w.stakeThanks > 0 && (
                        <span style={{ color: t.muted }}> 💰{formatAmount(w.stakeThanks)}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
