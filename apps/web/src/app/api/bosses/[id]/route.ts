import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { refreshOverlays } from "@/lib/bridge";

export const dynamic = "force-dynamic";

/** PATCH to reset a boss (hp = maxHp, not defeated). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { reset?: boolean };
  if (body.reset) {
    const boss = await prisma.boss.findFirst({ where: { id: params.id, channelId: r.channelId } });
    if (boss) {
      await prisma.boss.update({ where: { id: boss.id }, data: { hp: boss.maxHp, defeated: false } });
      await refreshOverlays(r.channelId);
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  await prisma.boss.deleteMany({ where: { id: params.id, channelId: r.channelId } });
  await refreshOverlays(r.channelId);
  return NextResponse.json({ ok: true });
}
