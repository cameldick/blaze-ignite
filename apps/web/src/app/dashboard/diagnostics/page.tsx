"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Diag = {
  channel: { displayName: string; scopes: string[]; tokenExpiresAt: string | null; overlayToken: string } | null;
  bridge: { status: { mode?: string; connected?: boolean; lastEventAt?: string; lastError?: string } | null; error?: string };
  endpoints: { rest: string; ws: string };
};

export default function DiagnosticsPage() {
  const [d, setD] = useState<Diag | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    fetch("/api/diagnostics", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setD);
  }, [tick]);

  const card = "rounded-xl border border-zinc-800 bg-zinc-900/40 p-5";
  const status = d?.bridge?.status;
  const connected = status?.connected;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">← Dashboard</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-3xl font-black">Diagnostics</h1>
        <button onClick={() => setTick((t) => t + 1)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:border-zinc-500">
          Refresh
        </button>
      </div>

      {!d ? (
        <p className="mt-6 text-zinc-500">Loading…</p>
      ) : (
        <div className="mt-6 space-y-4">
          <div className={card}>
            <h2 className="font-bold">Event bridge</h2>
            <Row k="Adapter mode" v={status?.mode ?? "—"} />
            <Row k="Connected" v={connected == null ? "unknown" : connected ? "yes ✅" : "no ❌"} />
            <Row k="Last event" v={status?.lastEventAt ?? "—"} />
            <Row k="Last error" v={status?.lastError ?? d.bridge?.error ?? "none"} />
          </div>

          <div className={card}>
            <h2 className="font-bold">Channel</h2>
            <Row k="Name" v={d.channel?.displayName ?? "—"} />
            <Row k="Scopes" v={(d.channel?.scopes ?? []).join(", ") || "—"} />
            <Row k="Token expires" v={d.channel?.tokenExpiresAt ?? "—"} />
          </div>

          <div className={card}>
            <h2 className="font-bold">Blaze endpoints</h2>
            <Row k="REST" v={d.endpoints.rest} />
            <Row k="WebSocket" v={d.endpoints.ws} />
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="mt-2 flex justify-between gap-4 text-sm">
      <span className="text-zinc-500">{k}</span>
      <span className="truncate text-right text-zinc-200">{v}</span>
    </div>
  );
}
