"use client";

import { motion, AnimatePresence } from "framer-motion";
import { THEMES, DEFAULT_THEME } from "@blaze-ignite/shared";
import { formatAmount, posClass, type OverlayState } from "@/lib/useOverlaySocket";

// Finance semantics: green = up/long, red = down/short.
const UP = "#34d399";
const DOWN = "#f87171";

/** Build a smooth-ish sparkline path (line + closed area) from the index series. */
function spark(history: number[], w = 300, h = 60) {
  if (history.length < 2) return { line: "", area: "", last: [w, h / 2] as [number, number] };
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return [x, y] as [number, number];
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return { line, area, last: pts[pts.length - 1]! };
}

function fmtIndex(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
function fmtClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Stream Market — "trade the streamer". A live momentum index with a sparkline;
 * during a round, LONG vs SHORT books race and a countdown ticks; on settle the
 * winning side lights up with a P&L reveal.
 */
export function MarketWidget({
  state,
  pos,
  theme = DEFAULT_THEME,
}: {
  state: OverlayState;
  pos?: string | null;
  theme?: string;
}) {
  const t = THEMES[theme] ?? THEMES[DEFAULT_THEME]!;
  const m = state.market;
  if (!m) return <div className="overlay-root h-screen w-screen" />;

  const W = 300;
  const H = 60;
  const { line, area, last } = spark(m.history, W, H);
  const ref = m.history[0] ?? m.index;
  const deltaPct = ref ? ((m.index - ref) / ref) * 100 : 0;
  const rising = m.index >= ref;
  const trend = rising ? UP : DOWN;
  const round = m.round;
  const settled = round?.status === "settled";
  const longWon = settled && round?.outcome === "long";

  return (
    <div className={`overlay-root flex h-screen w-screen p-8 ${posClass(pos, "top-center")}`}>
      <div
        className="w-[440px] max-w-full overflow-hidden rounded-2xl border shadow-2xl backdrop-blur"
        style={{ background: t.surface, borderColor: `${trend}66`, color: t.text, boxShadow: `0 0 44px ${trend}33` }}
      >
        {/* header + index */}
        <div className="flex items-end justify-between px-6 pt-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: t.muted }}>
              <motion.span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: trend }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              $STREAM · Market
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-black tabular-nums tracking-tight">{fmtIndex(m.index)}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: trend }}>
                {rising ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(2)}%
              </span>
            </div>
          </div>
          {round && !settled && round.closesAt && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest" style={{ color: t.muted }}>closes</div>
              <div className="text-xl font-bold tabular-nums">{fmtClock(round.closesAt - Date.now())}</div>
            </div>
          )}
        </div>

        {/* sparkline */}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-[60px] w-full">
          <defs>
            <linearGradient id="mktfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trend} stopOpacity="0.35" />
              <stop offset="100%" stopColor={trend} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#mktfill)" />
          <motion.path
            d={line}
            fill="none"
            stroke={trend}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ d: line }}
          />
          <circle cx={last[0]} cy={last[1]} r={3} fill={trend} />
        </svg>

        {/* round book */}
        <AnimatePresence mode="wait">
          {round && (
            <motion.div
              key={settled ? "settled" : "open"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-6 pb-5 pt-2"
            >
              {settled ? (
                <div className="text-center">
                  <div className="text-lg font-black" style={{ color: longWon ? UP : DOWN }}>
                    {longWon ? "📈 LONG WINS" : "📉 SHORT WINS"}
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums" style={{ color: t.muted }}>
                    {fmtIndex(round.entryIndex)} → {fmtIndex(round.exitIndex ?? m.index)}
                  </div>
                  {round.winners && round.winners.length > 0 && (
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm">
                      {round.winners.map((w, i) => (
                        <span key={i}>
                          🏆 {w.name}
                          {w.stakeThanks > 0 && <span style={{ color: t.muted }}> 💰{formatAmount(w.stakeThanks)}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs font-bold">
                    <span style={{ color: UP }}>LONG {round.long.pct.toFixed(0)}%</span>
                    <span style={{ color: t.muted }}>enter {fmtIndex(round.entryIndex)} · !long / !short</span>
                    <span style={{ color: DOWN }}>{round.short.pct.toFixed(0)}% SHORT</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <motion.div className="h-full" style={{ background: UP }} initial={false} animate={{ width: `${round.long.pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                    <motion.div className="h-full" style={{ background: DOWN }} initial={false} animate={{ width: `${round.short.pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] tabular-nums" style={{ color: t.muted }}>
                    <span>{round.long.backers} traders{round.long.thanks > 0 && ` · 💰${formatAmount(round.long.thanks)}`}</span>
                    <span>{round.short.backers} traders{round.short.thanks > 0 && ` · 💰${formatAmount(round.short.thanks)}`}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {!round && <div className="pb-4" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
