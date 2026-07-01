"use client";

import { motion } from "framer-motion";
import { THEMES, DEFAULT_THEME } from "@blaze-ignite/shared";
import { formatAmount, posClass, type OverlayState } from "@/lib/useOverlaySocket";

/** Tip war: tips are weighted votes across options; bars race in real time. */
export function TipWarWidget({
  state,
  pos,
  theme = DEFAULT_THEME,
}: {
  state: OverlayState;
  pos?: string | null;
  theme?: string;
}) {
  const t = THEMES[theme] ?? THEMES[DEFAULT_THEME]!;
  const wars = [...state.wars.values()];
  return (
    <div className={`overlay-root flex h-screen w-screen p-8 ${posClass(pos, "bottom-right")}`}>
      <div className="flex w-[520px] max-w-full flex-col gap-4">
      {wars.map((w) => {
        const total = w.options.reduce((s, o) => s + o.total, 0) || 1;
        return (
          <div
            key={w.warId}
            className="rounded-xl border px-5 py-4 backdrop-blur"
            style={{ background: t.surface, borderColor: t.accent, color: t.text }}
          >
            <div className="mb-3 font-semibold">{w.title}</div>
            <div className="space-y-2">
              {w.options.map((o, i) => {
                const pct = (o.total / total) * 100;
                const color = i % 2 === 0 ? t.accent : t.accent2;
                return (
                  <div key={o.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{o.label}</span>
                      <span className="tabular-nums" style={{ color: t.muted }}>
                        {formatAmount(o.total)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
