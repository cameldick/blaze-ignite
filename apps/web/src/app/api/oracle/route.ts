import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { refreshOverlays } from "@/lib/bridge";

export const dynamic = "force-dynamic";

/** Reset the Oracle leaderboard (new season). */
export async function DELETE(_req: NextRequest) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  await prisma.oracle.deleteMany({ where: { channelId: r.channelId } });
  await refreshOverlays(r.channelId);
  return NextResponse.json({ ok: true });
}
