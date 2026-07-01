import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Prisma } from "@blaze-ignite/db";
import { RuleMatch, ActionConfig } from "@blaze-ignite/shared";
import { requireChannelId } from "@/lib/api";
import { reloadRulesOnBridge } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const Body = z.object({
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
  match: RuleMatch.default({}),
  action: ActionConfig,
});

export async function POST(req: NextRequest) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const rule = await prisma.actionRule.create({
    data: {
      channelId: r.channelId,
      priority: parsed.data.priority ?? 100,
      enabled: parsed.data.enabled ?? true,
      match: parsed.data.match as Prisma.InputJsonValue,
      action: parsed.data.action as Prisma.InputJsonValue,
    },
  });
  await reloadRulesOnBridge(r.channelId);
  return NextResponse.json(rule);
}
