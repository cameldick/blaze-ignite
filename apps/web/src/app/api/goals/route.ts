import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { refreshOverlays, reloadRulesOnBridge } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const Body = z.object({ title: z.string().min(1), target: z.number().positive() });

export async function POST(req: NextRequest) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const goal = await prisma.goal.create({
    data: { channelId: r.channelId, title: parsed.data.title, target: parsed.data.target },
  });
  // Auto-create the rule so Thanks immediately fund this goal.
  await prisma.actionRule.create({
    data: { channelId: r.channelId, priority: 50, match: {}, action: { type: "goal", goalId: goal.id } },
  });
  await Promise.all([refreshOverlays(r.channelId), reloadRulesOnBridge(r.channelId)]);
  return NextResponse.json(goal);
}
