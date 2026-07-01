import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Prisma } from "@blaze-ignite/db";
import { RuleMatch, ActionConfig } from "@blaze-ignite/shared";
import { requireChannelId } from "@/lib/api";
import { reloadRulesOnBridge } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const Patch = z.object({
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  match: RuleMatch.optional(),
  action: ActionConfig.optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { count } = await prisma.actionRule.updateMany({
    where: { id: params.id, channelId: r.channelId },
    data: {
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
      ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
      ...(parsed.data.match !== undefined && { match: parsed.data.match as Prisma.InputJsonValue }),
      ...(parsed.data.action !== undefined && { action: parsed.data.action as Prisma.InputJsonValue }),
    },
  });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await reloadRulesOnBridge(r.channelId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  await prisma.actionRule.deleteMany({ where: { id: params.id, channelId: r.channelId } });
  await reloadRulesOnBridge(r.channelId);
  return NextResponse.json({ ok: true });
}
