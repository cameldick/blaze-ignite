import { NextRequest, NextResponse } from "next/server";
import { requireChannelId } from "@/lib/api";
import { previewAlert } from "@/lib/bridge";

export const dynamic = "force-dynamic";

/** Preview an alert with the exact config in the dashboard card (saved or not). */
export async function POST(req: NextRequest) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as {
    eventKind?: "thanks" | "follow" | "subscription" | "gift";
    text?: string;
    theme?: string;
    animation?: string;
    durationSec?: number;
    amount?: number;
    fontSize?: number;
    sound?: string;
    volume?: number;
  };
  await previewAlert(r.channelId, {
    eventKind: body.eventKind ?? "thanks",
    text: body.text,
    theme: body.theme ?? "ignite-dark",
    animation: body.animation ?? "pop",
    durationSec: body.durationSec ?? 6,
    amount: body.amount,
    fontSize: body.fontSize,
    sound: body.sound,
    volume: body.volume,
  });
  return NextResponse.json({ ok: true });
}
