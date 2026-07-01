"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { THEMES, DEFAULT_THEME } from "@blaze-ignite/shared";
import { formatAmount, posClass, type OverlayState } from "@/lib/useOverlaySocket";

/**
 * Renders the FIFO alert queue one at a time. The currently shown alert
 * auto-dismisses after its durationSec, advancing the queue. Driven by Blaze
 * `channel.thanks` — amount is unitless, shown as a clean formatted number.
 */
export function AlertWidget({ state, pos }: { state: OverlayState; pos?: string | null }) {
  const current = state.alerts[0];

  useEffect(() => {
    if (!current) return;
    // Play the alert sound once, at the configured volume. Autoplay is allowed
    // in OBS browser sources; in a plain browser tab it may be blocked until the
    // page is interacted with, so failures are swallowed.
    if (current.sound) {
      try {
        const audio = new Audio(current.sound);
        audio.volume = Math.min(1, Math.max(0, (current.volume ?? 50) / 100));
        void audio.play().catch(() => {});
      } catch {
        /* ignore audio errors — never block the visual alert */
      }
    }
    const t = setTimeout(() => state.dismissAlert(current._id), current.durationSec * 1000);
    return () => clearTimeout(t);
  }, [current, state]);

  return (
    <div className={`overlay-root flex h-screen w-screen p-8 ${posClass(pos, "top-center")}`}>
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current._id}
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            <AlertCard alert={current} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LABELS: Record<string, string> = {
  thanks: "new thanks",
  follow: "new follower",
  subscription: "new subscriber",
  gift: "gifted subs",
};

function AlertCard({ alert }: { alert: OverlayState["alerts"][number] }) {
  const theme = THEMES[alert.theme] ?? THEMES[DEFAULT_THEME]!;
  const showAmount = alert.amount != null;
  const amountLabel = alert.eventKind === "gift" ? "subs" : "thanks";
  return (
    <div
      className="min-w-[420px] max-w-[560px] rounded-2xl border px-6 py-5 shadow-2xl backdrop-blur"
      style={{
        background: theme.surface,
        borderColor: theme.accent,
        boxShadow: `0 0 40px ${theme.accent}66`,
        color: theme.text,
      }}
    >
      <div className="flex items-center gap-4">
        {alert.actorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={alert.actorAvatar}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
            style={{ outline: `2px solid ${theme.accent}` }}
          />
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
            style={{ background: theme.accent, color: "#0a0a0c" }}
          >
            {alert.actorName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="leading-tight" style={{ fontSize: alert.fontSize ? `${alert.fontSize}px` : undefined }}>
          {alert.headline ? (
            <div className="font-semibold">{alert.headline}</div>
          ) : (
            <>
              <div className="text-sm" style={{ color: theme.muted }}>
                {LABELS[alert.eventKind] ?? "new event"}
              </div>
              <div className="font-semibold">{alert.actorName}</div>
            </>
          )}
        </div>
        {showAmount && (
          <div className="ml-auto text-right">
            <div className="text-3xl font-black tabular-nums" style={{ color: theme.accent2 }}>
              {formatAmount(alert.amount!)}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.muted }}>
              {amountLabel}
            </div>
          </div>
        )}
      </div>

      {alert.message && (
        <p className="mt-3 text-sm" style={{ color: theme.text }}>
          “{alert.message}”
        </p>
      )}
    </div>
  );
}
