import { NextResponse } from "next/server";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";

export const dynamic = "force-dynamic";

/** One fetch the dashboard uses to render every editor section. */
export async function GET() {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const [channel, rules, goals, wars, bosses, predictions, oracle] = await Promise.all([
    prisma.channel.findUnique({ where: { id: r.channelId } }),
    prisma.actionRule.findMany({ where: { channelId: r.channelId }, orderBy: { priority: "asc" } }),
    prisma.goal.findMany({ where: { channelId: r.channelId }, orderBy: { createdAt: "asc" } }),
    prisma.tipWar.findMany({
      where: { channelId: r.channelId },
      include: { options: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.boss.findMany({ where: { channelId: r.channelId }, orderBy: { createdAt: "asc" } }),
    prisma.prediction.findMany({
      where: { channelId: r.channelId },
      include: { options: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.oracle.findMany({
      where: { channelId: r.channelId },
      orderBy: [{ points: "desc" }, { bestStreak: "desc" }],
      take: 10,
    }),
  ]);
  if (!channel) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    channel: { id: channel.id, displayName: channel.displayName, overlayToken: channel.overlayToken },
    rules,
    goals,
    wars,
    bosses,
    predictions,
    oracle,
  });
}
