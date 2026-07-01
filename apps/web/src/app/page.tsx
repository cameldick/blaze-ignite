import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <span className="inline-block rounded-full border border-ignite/40 px-3 py-1 text-xs font-semibold text-ignite">
        Built for the Blaze Builder Challenge
      </span>

      <h1 className="mt-6 text-5xl font-black leading-tight tracking-tight sm:text-6xl">
        Your Blaze support & votes,
        <br />
        <span className="bg-gradient-to-r from-ignite to-ignite-glow bg-clip-text text-transparent">
          live on your stream.
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-zinc-300">
        Blaze Ignite turns every <strong>Thanks</strong> into an instant on-stream
        action — alerts, goals, tip-wars, and boss battles — and puts your
        on-chain <strong>Backstage votes</strong> live on screen with a Spotlight
        leaderboard. No virtual coins. No AI gimmicks. Real Blaze events driving
        real moments, in real time.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-ignite px-6 py-3 font-semibold text-black transition hover:brightness-110"
        >
          Connect your channel
        </Link>
        <a
          href="https://dev.blaze.stream"
          className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 transition hover:border-zinc-500"
        >
          Blaze API docs
        </a>
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { t: "Thanks Alerts", d: "Animated, tier-styled alerts on every Thanks." },
          { t: "Support Goals", d: "Fund a goal live as Thanks roll in." },
          { t: "Tip Wars", d: "A keyword in a Thanks routes support to an option." },
          { t: "Boss Battles", d: "Collective Thanks deal damage to unlock rewards." },
          { t: "Backstage Spotlight", d: "Live on-chain vote leaderboard for the epoch." },
        ].map((f) => (
          <div key={f.t} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-lg font-semibold text-ignite">{f.t}</div>
            <p className="mt-2 text-sm text-zinc-400">{f.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-20 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
        <h2 className="text-2xl font-bold">Why it&apos;s different</h2>
        <ul className="mt-4 space-y-2 text-zinc-300">
          <li>✅ Driven by real Blaze events (Thanks &amp; Backstage votes) — not fake points.</li>
          <li>✅ Backstage Spotlight puts on-chain, wallet-backed votes live on stream — something Blaze shows only on its site.</li>
          <li>✅ Real-time Socket.IO event delivery, with a polling fallback.</li>
          <li>✅ Tight, polished, production-ready — not a sprawling half-built suite.</li>
        </ul>
      </div>

      <footer className="mt-20 text-sm text-zinc-600">
        Blaze Ignite — Tip-to-Action · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
