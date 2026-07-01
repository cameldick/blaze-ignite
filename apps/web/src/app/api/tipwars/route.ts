import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { refreshOverlays, reloadRulesOnBridge } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const Body = z.object({
  title: z.string().min(1),
  options: z
    .array(z.object({ label: z.string().min(1), keyword: z.string().optional() }))
    .min(2)
    .max(6),
});

export async function POST(req: NextRequest) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const war = await prisma.tipWar.create({
    data: {
      channelId: r.channelId,
      title: parsed.data.title,
      options: {
        create: parsed.data.options.map((o) => ({ label: o.label, keyword: o.keyword || null })),
      },
    },
    include: { options: true },
  });
  // Auto-create the rule so Thanks route to options by keyword in the message.
  await prisma.actionRule.create({
    data: { channelId: r.channelId, priority: 50, match: {}, action: { type: "tipwar", warId: war.id } },
  });
  await Promise.all([refreshOverlays(r.channelId), reloadRulesOnBridge(r.channelId)]);
  return NextResponse.json(war);
}
