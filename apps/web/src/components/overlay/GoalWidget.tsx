"use client";

import { motion } from "framer-motion";
import { THEMES, DEFAULT_THEME } from "@blaze-ignite/shared";
import { formatAmount, posClass, type OverlayState } from "@/lib/useOverlaySocket";

/** Tip-funded goal bars. Renders every active goal stacked vertically. */
export function GoalWidget({
  state,
  pos,
  theme = DEFAULT_THEME,
}: {
  state: OverlayState;
  pos?: string | null;
  theme?: string;
}) {
  const t = THEMES[theme] ?? THEMES[DEFAULT_THEME]!;
  const goals = [...state.goals.values()];
  return (
    <div className={`overlay-root flex h-screen w-screen p-8 ${posClass(pos, "bottom-center")}`}>
      <div className="flex w-[640px] max-w-full flex-col gap-3">
      {goals.map((g) => {
        const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
        return (
          <div
            key={g.goalId}
            className="rounded-xl border px-5 py-4 backdrop-blur"
            style={{ background: t.surface, borderColor: t.accent, color: t.text }}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-semibold">{g.title}</span>
              <span className="tabular-nums text-sm" style={{ color: t.muted }}>
                {formatAmount(g.current)} / {formatAmount(g.target)}
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            {pct >= 100 && (
              <div className="mt-2 text-sm font-bold" style={{ color: t.accent2 }}>
                🎉 Goal reached!
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
