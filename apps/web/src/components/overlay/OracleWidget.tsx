"use client";

import { motion } from "framer-motion";
import { THEMES, DEFAULT_THEME } from "@blaze-ignite/shared";
import { posClass, type OverlayState } from "@/lib/useOverlaySocket";

/**
 * The "Oracle" leaderboard — the channel's sharpest predictors, ranked by
 * points earned calling predictions, with their current win streak.
 */
export function OracleWidget({
  state,
  pos,
  theme = DEFAULT_THEME,
}: {
  state: OverlayState;
  pos?: string | null;
  theme?: string;
}) {
  const t = THEMES[theme] ?? THEMES[DEFAULT_THEME]!;
  const leaders = state.oracle?.leaders ?? [];
  if (leaders.length === 0) return <div className="overlay-root h-screen w-screen" />;

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

  return (
    <div className={`overlay-root flex h-screen w-screen p-8 ${posClass(pos, "center-right")}`}>
      <div
        className="w-[320px] max-w-full rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur"
        style={{ background: t.surface, borderColor: t.accent, color: t.text }}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">🔮</span>
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: t.accent }}>
            Oracle Leaderboard
          </span>
        </div>
        <div className="space-y-1.5">
          {leaders.map((l, i) => (
            <motion.div
              key={l.name + i}
              layout
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
              style={{ background: i < 3 ? `${t.accent}14` : "transparent" }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-6 shrink-0 text-center">{medal(i)}</span>
                <span className="truncate font-semibold">{l.name}</span>
                {l.streak >= 2 && (
                  <span className="shrink-0 text-xs" style={{ color: t.accent2 }}>
                    🔥{l.streak}
                  </span>
                )}
              </span>
              <span className="tabular-nums font-bold" style={{ color: t.accent }}>
                {l.points}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
