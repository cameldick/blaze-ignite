import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireChannelId } from "@/lib/api";
import { openMarket, settleMarket, cancelMarket } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["open", "settle", "cancel"]),
  durationSec: z.number().int().min(15).max(900).optional(),
});

/** Control the Stream Market round (state lives in the always-on bridge). */
export async function POST(req: NextRequest) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    if (parsed.data.action === "open") await openMarket(r.channelId, parsed.data.durationSec ?? 180);
    else if (parsed.data.action === "settle") await settleMarket(r.channelId);
    else await cancelMarket(r.channelId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("market control failed", err);
    return NextResponse.json({ error: "bridge_unreachable" }, { status: 502 });
  }
}
