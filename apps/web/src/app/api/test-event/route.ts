import { NextRequest, NextResponse } from "next/server";
import { getSessionChannelId } from "@/lib/session";
import { sendTestEvent } from "@/lib/bridge";

export const dynamic = "force-dynamic";

/** Proxy the dashboard "Test Event" to the bridge for the session's channel. */
export async function POST(req: NextRequest) {
  const channelId = getSessionChannelId();
  if (!channelId) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    kind?: "thanks" | "follow" | "subscription" | "gift" | "chat" | "vote";
    amount?: number;
    actorName?: string;
    message?: string;
    address?: string;
    preview?: boolean;
  };
  try {
    await sendTestEvent(channelId, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("test-event failed", err);
    return NextResponse.json({ error: "bridge_unreachable" }, { status: 502 });
  }
}
