import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { refreshOverlays, reloadRulesOnBridge } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1),
  maxHp: z.number().positive(),
  rewardText: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const boss = await prisma.boss.create({
    data: {
      channelId: r.channelId,
      name: parsed.data.name,
      maxHp: parsed.data.maxHp,
      hp: parsed.data.maxHp,
      rewardText: parsed.data.rewardText,
    },
  });
  await prisma.actionRule.create({
    data: {
      channelId: r.channelId,
      priority: 50,
      match: {},
      action: { type: "boss", bossId: boss.id, damagePerPoint: 1 },
    },
  });
  await Promise.all([refreshOverlays(r.channelId), reloadRulesOnBridge(r.channelId)]);
  return NextResponse.json(boss);
}
