import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { refreshOverlays } from "@/lib/bridge";

export const dynamic = "force-dynamic";

/** Delete a goal (scoped to the session channel). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  await prisma.goal.deleteMany({ where: { id: params.id, channelId: r.channelId } });
  await refreshOverlays(r.channelId);
  return NextResponse.json({ ok: true });
}
