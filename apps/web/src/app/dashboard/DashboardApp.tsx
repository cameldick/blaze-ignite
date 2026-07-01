"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { THEMES } from "@blaze-ignite/shared";
import { useBlazePrice, usdBracket, usdOnly } from "@/lib/useBlazePrice";

const WIDGETS = ["alert", "goal", "boss", "tipwar", "spotlight"];
const ANIMATIONS = ["pop", "glow", "pulse", "slideIn"];

type Config = {
  channel: { id: string; displayName: string; overlayToken: string };
  rules: {
    id: string;
    enabled: boolean;
    priority: number;
    action: {
      type: string;
      on?: string[];
      text?: string;
      theme?: string;
      animation?: string;
      durationSec?: number;
    };
  }[];
  goals: { id: string; title: string; current: number; target: number }[];
  wars: { id: string; title: string; options: { id: string; label: string; total: number }[] }[];
  bosses: { id: string; name: string; hp: number; maxHp: number; defeated: boolean }[];
};

const j = (method: string, url: string, body?: unknown) =>
  fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

/** Copy with a fallback for when navigator.clipboard is unavailable/blocked. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function DashboardApp({
  channelName,
  overlayBase,
}: {
  channelName: string;
  overlayBase: string;
}) {
  const [cfg, setCfg] = useState<Config | null>(null);

  const price = useBlazePrice();

  const reload = useCallback(async () => {
    const res = await fetch("/api/config", { cache: "no-store" });
    if (res.ok) setCfg(await res.json());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,90,31,0.10),transparent_70%)]"
      />

      {/* brand bar */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/40 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
            <span>🔥</span> Blaze Ignite
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm"
              title="Live $BLAZE price from the Avalanche DEX (DexScreener)"
            >
              <span className="text-zinc-500">$BLAZE </span>
              <span className="font-semibold text-ignite">
                {price != null ? `$${price.toLocaleString("en-US", { maximumSignificantDigits: 4 })}` : "—"}
              </span>
            </div>
            <PoweredByBlaze className="hidden sm:inline-flex" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-zinc-500">Creator dashboard</div>
            <h1 className="mt-1 text-3xl font-black">{channelName}</h1>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connected &amp; live
            </p>
          </div>
          <nav className="flex gap-2 text-sm">
            <Link href="/dashboard/analytics" className="rounded-lg border border-zinc-700 px-3 py-1.5 transition hover:border-ignite/50 hover:text-white">
              Analytics
            </Link>
            <Link href="/dashboard/diagnostics" className="rounded-lg border border-zinc-700 px-3 py-1.5 transition hover:border-ignite/50 hover:text-white">
              Diagnostics
            </Link>
          </nav>
        </header>

        <p className="mt-3 max-w-2xl text-sm text-zinc-500">
          Configure how your Blaze events appear on stream, then add the overlay URLs below as
          Browser Sources in OBS. Changes apply to your overlays instantly.
        </p>

        <TestEvent />
        <Overlays base={overlayBase} />

        {cfg && (
          <>
            <Goals goals={cfg.goals} onChange={reload} />
            <Bosses bosses={cfg.bosses} onChange={reload} />
            <TipWars wars={cfg.wars} onChange={reload} />
            <Alerts rules={cfg.rules} onChange={reload} />
          </>
        )}

        <footer className="mt-16 flex items-center justify-between border-t border-zinc-800 pt-6 text-sm text-zinc-600">
          <span>🔥 Blaze Ignite</span>
          <span className="flex items-center gap-1.5">
            Powered by{" "}
            <a href="https://blaze.stream" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-ignite">
              Blaze
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}

function PoweredByBlaze({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://blaze.stream"
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-ignite/50 hover:text-white ${className}`}
    >
      <span className="text-ignite">⚡</span> Powered by Blaze
    </a>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

const card = "rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3";
const input = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm";
const btn = "rounded-lg bg-ignite px-3 py-1.5 text-sm font-semibold text-black hover:brightness-110";
const btnGhost = "rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:border-zinc-500";

function TestEvent() {
  const [amount, setAmount] = useState(50);
  const [preview, setPreview] = useState(true);
  const [done, setDone] = useState(false);
  const price = useBlazePrice();
  return (
    <Section title="Test Event" hint="Fire a simulated Thanks to preview your overlays.">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <label className="text-sm text-zinc-400">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className={`${input} w-24`}
        />
        <span className="text-xs text-zinc-500">{usdBracket(amount, price)}</span>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
          Preview only (don&apos;t change goal/boss)
        </label>
        <button
          className={btn}
          onClick={async () => {
            await j("POST", "/api/test-event", { amount, preview, actorName: "Supporter", message: "Test Thanks!" });
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
        >
          {done ? "Sent ✓" : "Fire"}
        </button>
      </div>
    </Section>
  );
}

const WIDGET_DEFAULT_POS: Record<string, string> = {
  alert: "top-center",
  goal: "bottom-center",
  boss: "top-left",
  tipwar: "bottom-right",
  spotlight: "top-right",
};
const POSITIONS = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
];

function Overlays({ base }: { base: string }) {
  const [pos, setPos] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <Section
      title="OBS overlay sources"
      hint="Add each as a Browser Source in OBS. Pick where it sits on screen — each overlay defaults to a different spot so they don't overlap."
    >
      {WIDGETS.map((w) => {
        const p = pos[w] ?? WIDGET_DEFAULT_POS[w] ?? "top-center";
        const url = `${base}/${w}?pos=${p}`;
        return (
          <div key={w} className={`${card} flex flex-wrap items-center gap-3`}>
            <span className="w-20 font-semibold">{w}</span>
            <code className="min-w-0 flex-1 truncate text-xs text-zinc-400">{url}</code>
            <select
              value={p}
              onChange={(e) => setPos((prev) => ({ ...prev, [w]: e.target.value }))}
              className={input}
            >
              {POSITIONS.map((pp) => (
                <option key={pp} value={pp}>{pp}</option>
              ))}
            </select>
            <button
              className={btnGhost}
              onClick={async () => {
                const ok = await copyText(url);
                setCopied(ok ? w : `${w}:fail`);
                setTimeout(() => setCopied(null), 1500);
              }}
            >
              {copied === w ? "Copied ✓" : copied === `${w}:fail` ? "Select & copy" : "Copy"}
            </button>
          </div>
        );
      })}
    </Section>
  );
}

function Goals({ goals, onChange }: { goals: Config["goals"]; onChange: () => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(1000);
  const price = useBlazePrice();
  return (
    <Section title="Goals" hint="Thanks contribute to the goal total.">
      {goals.map((g) => (
        <div key={g.id} className={`${card} flex items-center justify-between`}>
          <span>
            {g.title} —{" "}
            <span className="tabular-nums text-zinc-400">
              {g.current} / {g.target}
            </span>{" "}
            <span className="text-xs text-zinc-500">
              (≈ {usdOnly(g.current, price)} / {usdOnly(g.target, price)})
            </span>
          </span>
          <button className={btnGhost} onClick={async () => { await j("DELETE", `/api/goals/${g.id}`); onChange(); }}>
            Delete
          </button>
        </div>
      ))}
      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <input placeholder="Goal title" value={title} onChange={(e) => setTitle(e.target.value)} className={`${input} flex-1`} />
        <input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} className={`${input} w-28`} />
        <span className="text-xs text-zinc-500">{usdBracket(target, price)}</span>
        <button
          className={btn}
          onClick={async () => {
            if (!title) return;
            await j("POST", "/api/goals", { title, target });
            setTitle("");
            onChange();
          }}
        >
          Add goal
        </button>
      </div>
    </Section>
  );
}

function Bosses({ bosses, onChange }: { bosses: Config["bosses"]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [maxHp, setMaxHp] = useState(500);
  const price = useBlazePrice();
  return (
    <Section title="Boss battles" hint="Thanks chip away the boss's $BLAZE health (1 per unit of Thanks).">
      {bosses.map((b) => (
        <div key={b.id} className={`${card} flex items-center justify-between`}>
          <span>
            {b.name} — <span className="tabular-nums text-zinc-400">{Math.ceil(b.hp)} / {b.maxHp} $BLAZE</span>{" "}
            <span className="text-xs text-zinc-500">
              (≈ {usdOnly(Math.ceil(b.hp), price)} / {usdOnly(b.maxHp, price)})
            </span>
            {b.defeated && <span className="ml-2 text-emerald-400">defeated</span>}
          </span>
          <div className="flex gap-2">
            <button className={btnGhost} onClick={async () => { await j("PATCH", `/api/bosses/${b.id}`, { reset: true }); onChange(); }}>
              Reset
            </button>
            <button className={btnGhost} onClick={async () => { await j("DELETE", `/api/bosses/${b.id}`); onChange(); }}>
              Delete
            </button>
          </div>
        </div>
      ))}
      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <input placeholder="Boss name" value={name} onChange={(e) => setName(e.target.value)} className={`${input} flex-1`} />
        <input type="number" value={maxHp} onChange={(e) => setMaxHp(Number(e.target.value))} className={`${input} w-28`} />
        <span className="text-xs text-zinc-500" title="Total value to defeat, at current $BLAZE price">
          {usdBracket(maxHp, price)}
        </span>
        <button
          className={btn}
          onClick={async () => {
            if (!name) return;
            await j("POST", "/api/bosses", { name, maxHp });
            setName("");
            onChange();
          }}
        >
          Add boss
        </button>
      </div>
    </Section>
  );
}

function TipWars({ wars, onChange }: { wars: Config["wars"]; onChange: () => void }) {
  const [title, setTitle] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const price = useBlazePrice();
  return (
    <Section title="Tip wars" hint="Viewers route support by putting an option keyword in their Thanks message.">
      {wars.map((w) => (
        <div key={w.id} className={`${card} flex items-center justify-between`}>
          <span>
            {w.title} —{" "}
            <span className="text-zinc-400">
              {w.options.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && " vs "}
                  {o.label} ({o.total} <span className="text-zinc-500">≈ {usdOnly(o.total, price)}</span>)
                </span>
              ))}
            </span>
          </span>
          <button className={btnGhost} onClick={async () => { await j("DELETE", `/api/tipwars/${w.id}`); onChange(); }}>
            Delete
          </button>
        </div>
      ))}
      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <input placeholder="War title" value={title} onChange={(e) => setTitle(e.target.value)} className={`${input} flex-1`} />
        <input placeholder="Option A (keyword)" value={a} onChange={(e) => setA(e.target.value)} className={`${input} w-40`} />
        <input placeholder="Option B (keyword)" value={b} onChange={(e) => setB(e.target.value)} className={`${input} w-40`} />
        <button
          className={btn}
          onClick={async () => {
            if (!title || !a || !b) return;
            await j("POST", "/api/tipwars", {
              title,
              options: [{ label: a, keyword: a }, { label: b, keyword: b }],
            });
            setTitle(""); setA(""); setB("");
            onChange();
          }}
        >
          Add war
        </button>
      </div>
    </Section>
  );
}

const ALERT_TYPES = [
  { type: "thanks", label: "Thanks alert", defaultText: "Thanks {name} for {amount}! 🔥" },
  { type: "follow", label: "Follow alert", defaultText: "🎉 {name} just followed!" },
  { type: "subscription", label: "Subscription alert", defaultText: "💜 {name} just subscribed!" },
  { type: "gift", label: "Gifted subs alert", defaultText: "🎁 {name} gifted {amount} subs!" },
] as const;

const AMOUNT_TYPES = new Set(["thanks", "gift"]); // alerts that display/accept an amount

function Alerts({ rules, onChange }: { rules: Config["rules"]; onChange: () => void }) {
  return (
    <Section
      title="Alerts"
      hint="A separate, editable alert for each event. Use {name} (and {amount} for Thanks) in the message."
    >
      {ALERT_TYPES.map((meta) => {
        const rule = rules.find(
          (r) => r.action.type === "alert" && (r.action.on ?? ["thanks"]).includes(meta.type),
        );
        return <AlertEditor key={`${meta.type}:${rule?.id ?? "new"}`} meta={meta} rule={rule} onChange={onChange} />;
      })}
    </Section>
  );
}

function AlertEditor({
  meta,
  rule,
  onChange,
}: {
  meta: { type: string; label: string; defaultText: string };
  rule?: Config["rules"][number];
  onChange: () => void;
}) {
  const a = rule?.action;
  const [text, setText] = useState(a?.text ?? meta.defaultText);
  const [theme, setTheme] = useState(a?.theme ?? Object.keys(THEMES)[0]!);
  const [animation, setAnimation] = useState(a?.animation ?? ANIMATIONS[0]!);
  const [duration, setDuration] = useState(a?.durationSec ?? 8);
  const [saved, setSaved] = useState(false);

  const action = {
    type: "alert",
    theme,
    animation,
    durationSec: duration,
    on: [meta.type],
    text: text.trim() || undefined,
  };

  const save = async () => {
    if (rule) await j("PATCH", `/api/rules/${rule.id}`, { action });
    else await j("POST", "/api/rules", { action });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChange();
  };
  const preview = () =>
    j("POST", "/api/preview-alert", {
      eventKind: meta.type,
      text: text.trim() || undefined,
      theme,
      animation,
      durationSec: duration,
      amount: meta.type === "thanks" ? 50 : meta.type === "gift" ? 5 : undefined,
    });

  return (
    <div className={card}>
      <div className="mb-2 flex items-center justify-between">
        <strong>{meta.label}</strong>
        <span className="text-xs text-zinc-500">
          {rule ? (rule.enabled ? "● enabled" : "disabled") : "not set"}
        </span>
      </div>
      <input
        className={`${input} w-full`}
        placeholder="Alert message"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
        <span>
          Placeholders: {"{name}"}
          {AMOUNT_TYPES.has(meta.type) ? ", {amount}" : ""}
        </span>
        <button
          type="button"
          className="text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
          onClick={() => setText(meta.defaultText)}
        >
          reset to default
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={theme} onChange={(e) => setTheme(e.target.value)} className={input}>
          {Object.values(THEMES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={animation} onChange={(e) => setAnimation(e.target.value)} className={input}>
          {ANIMATIONS.map((an) => <option key={an} value={an}>{an}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm text-zinc-400">
          <input
            type="number"
            min={1}
            max={30}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={`${input} w-16`}
          />
          sec
        </label>
        <button className={btn} onClick={save}>{saved ? "Saved ✓" : rule ? "Save" : "Enable"}</button>
        <button className={btnGhost} onClick={preview} title="Fire a sample to your /alert overlay">
          Preview
        </button>
        {rule && (
          <button
            className={btnGhost}
            onClick={async () => { await j("PATCH", `/api/rules/${rule.id}`, { enabled: !rule.enabled }); onChange(); }}
          >
            {rule.enabled ? "Disable" : "Enable"}
          </button>
        )}
        {rule && (
          <button className={btnGhost} onClick={async () => { await j("DELETE", `/api/rules/${rule.id}`); onChange(); }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
