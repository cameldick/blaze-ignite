"use client";

import { motion } from "framer-motion";
import { THEMES, DEFAULT_THEME } from "@blaze-ignite/shared";
import { posClass, type OverlayState } from "@/lib/useOverlaySocket";

/** Boss meter: collective tips deal damage until the boss is defeated. */
export function BossWidget({
  state,
  pos,
  theme = DEFAULT_THEME,
}: {
  state: OverlayState;
  pos?: string | null;
  theme?: string;
}) {
  const t = THEMES[theme] ?? THEMES[DEFAULT_THEME]!;
  const bosses = [...state.bosses.values()];
  return (
    <div className={`overlay-root flex h-screen w-screen p-8 ${posClass(pos, "top-left")}`}>
      <div className="flex flex-col gap-3">
      {bosses.map((b) => {
        const pct = b.maxHp > 0 ? Math.max(0, (b.hp / b.maxHp) * 100) : 0;
        return (
          <div
            key={b.bossId}
            className="w-[560px] rounded-xl border px-5 py-4 backdrop-blur"
            style={{ background: t.surface, borderColor: t.accent, color: t.text }}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-lg font-black tracking-wide">{b.name}</span>
              <span className="tabular-nums text-sm" style={{ color: t.muted }}>
                {Math.ceil(b.hp)} / {b.maxHp} $BLAZE
              </span>
            </div>
            <div className="h-5 overflow-hidden rounded-md" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div
                className="h-full"
                style={{ background: b.defeated ? "#22c55e" : `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 140, damping: 18 }}
              />
            </div>
            {b.lastHit && !b.defeated && (
              <motion.div
                key={`${b.lastHit.actorName}-${b.hp}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-sm"
                style={{ color: t.accent2 }}
              >
                💥 {b.lastHit.actorName} hit for {Math.round(b.lastHit.damage)}!
              </motion.div>
            )}
            {b.defeated && (
              <div className="mt-2 text-sm font-bold" style={{ color: "#22c55e" }}>
                ☠️ Boss defeated!
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
