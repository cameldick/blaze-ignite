"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Analytics = {
  counts: Record<string, number>;
  live: { followerCount?: number; subscriberCount?: number; viewerCount?: number } | null;
  thanksTotal: number;
  votesTotal: number;
  topSupporters: { name: string | null; amount: number }[];
  topVoters: { name: string | null; amount: number }[];
  recent: { kind: string; actorName: string | null; amount: number | null; message: string | null; occurredAt: string }[];
};

export default function AnalyticsPage() {
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => {
    fetch("/api/analytics", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setA);
  }, []);

  const card = "rounded-xl border border-zinc-800 bg-zinc-900/40 p-5";
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">← Dashboard</Link>
      <h1 className="mt-2 text-3xl font-black">Analytics</h1>

      {!a ? (
        <p className="mt-6 text-zinc-500">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Thanks total" value={a.thanksTotal} />
            <Stat label="Votes total" value={a.votesTotal} />
            <Stat
              label={a.live?.followerCount != null ? "Followers (live)" : "Follows seen"}
              value={a.live?.followerCount ?? a.counts.follow ?? 0}
            />
            <Stat
              label={a.live?.subscriberCount != null ? "Subscribers (live)" : "Subs seen"}
              value={a.live?.subscriberCount ?? a.counts.subscription ?? 0}
            />
          </div>
          {a.live?.followerCount == null && (
            <p className="mt-2 text-xs text-zinc-600">
              Live counts from Blaze unavailable right now — showing events recorded since connect.
            </p>
          )}

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className={card}>
              <h2 className="font-bold">Top supporters</h2>
              <List rows={a.topSupporters} />
            </div>
            <div className={card}>
              <h2 className="font-bold">Top voters</h2>
              <List rows={a.topVoters} />
            </div>
          </div>

          <div className={`${card} mt-6`}>
            <h2 className="font-bold">Recent activity</h2>
            <ul className="mt-3 space-y-1 text-sm text-zinc-300">
              {a.recent.length === 0 && <li className="text-zinc-500">No events yet.</li>}
              {a.recent.map((e, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    <span className="text-zinc-500">{e.kind}</span> {e.actorName}
                    {e.message ? ` — “${e.message}”` : ""}
                  </span>
                  {e.amount != null && <span className="tabular-nums text-ignite">{e.amount}</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="text-2xl font-black tabular-nums text-ignite">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}

function List({ rows }: { rows: { name: string | null; amount: number }[] }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-zinc-500">No data yet.</p>;
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex justify-between">
          <span>{i + 1}. {r.name ?? "anonymous"}</span>
          <span className="tabular-nums text-ignite">{r.amount.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
