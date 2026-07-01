import Link from "next/link";

const FEATURES = [
  { t: "Thanks Alerts", d: "Animated, tier-styled alerts on every Thanks — editable per event." },
  { t: "Support Goals", d: "A progress bar that fills live as Thanks roll in toward your target." },
  { t: "Tip Wars", d: "Viewers pick a side with a keyword in their Thanks; bars race in real time." },
  { t: "Boss Battles", d: "Collective Thanks chip away a boss's meter to unlock a reward." },
  { t: "Backstage Spotlight", d: "A live, on-chain vote leaderboard for the current epoch." },
];

const DIFFERENTIATORS = [
  "Driven by real Blaze events — Thanks and Backstage votes, not fake points.",
  "Backstage Spotlight puts on-chain, wallet-backed votes live on stream.",
  "Real-time Socket.IO event delivery, with an automatic polling fallback.",
  "Tight, polished, production-ready — not a sprawling half-built suite.",
];

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ignite/15 ring-1 ring-ignite/30 text-ignite">
      <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden>
        <path d="M4 10.5l3.5 3.5L16 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function PoweredByBlaze({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://blaze.stream"
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-ignite/50 hover:text-white ${className}`}
    >
      <span className="text-ignite">⚡</span> Powered by Blaze
    </a>
  );
}

export default function Home() {
  return (
    <div className="relative">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,90,31,0.12),transparent_70%)]"
      />

      {/* top nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🔥</span>
          <span className="font-black tracking-tight">Blaze Ignite</span>
        </div>
        <div className="flex items-center gap-3">
          <PoweredByBlaze className="hidden sm:inline-flex" />
          <Link
            href="/dashboard"
            className="rounded-lg bg-ignite px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Open dashboard
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <span className="inline-block rounded-full border border-ignite/40 bg-ignite/5 px-3 py-1 text-xs font-semibold text-ignite">
          Built for the Blaze Builder Challenge
        </span>

        <h1 className="mt-6 text-5xl font-black leading-tight tracking-tight sm:text-6xl">
          Your Blaze support &amp; votes,
          <br />
          <span className="bg-gradient-to-r from-ignite to-ignite-glow bg-clip-text text-transparent">
            live on your stream.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-zinc-300">
          Blaze Ignite turns every <strong className="text-white">Thanks</strong> into an instant
          on-stream action — alerts, goals, tip-wars, and boss battles — and puts your on-chain{" "}
          <strong className="text-white">Backstage votes</strong> live on screen with a Spotlight
          leaderboard. No virtual coins. No AI gimmicks. Real Blaze events driving real moments, in
          real time.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-ignite px-6 py-3 font-semibold text-black shadow-lg shadow-ignite/20 transition hover:brightness-110"
          >
            Connect your channel
          </Link>
          <a
            href="https://dev.blaze.stream"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 transition hover:border-zinc-500"
          >
            Blaze API docs
          </a>
          <PoweredByBlaze className="sm:hidden" />
        </div>

        {/* feature grid */}
        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.t}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition hover:border-ignite/40 hover:bg-zinc-900/70"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ignite/10 text-sm font-bold text-ignite ring-1 ring-ignite/20">
                  {i + 1}
                </span>
                <div className="text-lg font-semibold text-white">{f.t}</div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.d}</p>
            </div>
          ))}
          {/* CTA tile completing the 3x2 grid */}
          <Link
            href="/dashboard"
            className="flex flex-col justify-between rounded-2xl border border-ignite/30 bg-gradient-to-br from-ignite/10 to-transparent p-6 transition hover:border-ignite/60"
          >
            <div className="text-lg font-semibold text-white">Go live in minutes</div>
            <div className="mt-3 text-sm font-semibold text-ignite">Connect your channel →</div>
          </Link>
        </div>

        {/* why it's different */}
        <section className="mt-20 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 bg-zinc-900/60 px-8 py-5">
            <h2 className="text-2xl font-bold">Why it&apos;s different</h2>
          </div>
          <ul className="grid gap-x-8 gap-y-5 p-8 sm:grid-cols-2">
            {DIFFERENTIATORS.map((d) => (
              <li key={d} className="flex items-start gap-3">
                <Check />
                <span className="text-zinc-300">{d}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* powered-by strip */}
        <div className="mt-16 flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-8 py-8 text-center">
          <PoweredByBlaze />
          <p className="max-w-xl text-sm text-zinc-400">
            Every overlay is driven by a genuine Blaze EventSub event, delivered in real time. Built
            on the official{" "}
            <a href="https://dev.blaze.stream" target="_blank" rel="noreferrer" className="text-ignite hover:underline">
              Blaze API
            </a>
            .
          </p>
        </div>

        <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-zinc-800 pt-8 text-sm text-zinc-600 sm:flex-row">
          <span>🔥 Blaze Ignite — Support &amp; Vote-to-Action</span>
          <span className="flex items-center gap-1.5">
            Powered by <a href="https://blaze.stream" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-ignite">Blaze</a>
          </span>
        </footer>
      </main>
    </div>
  );
}
