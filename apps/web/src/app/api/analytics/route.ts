import { NextResponse } from "next/server";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { decrypt } from "@/lib/crypto";
import { getChannelStats, type BlazeStats } from "@/lib/blaze";

export const dynamic = "force-dynamic";

/** Live follower/subscriber/viewer counts from Blaze (best effort). */
async function liveStats(channelId: string): Promise<BlazeStats | null> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return null;
  try {
    return await getChannelStats(decrypt(channel.accessTokenEnc));
  } catch (err) {
    console.warn("channels/stats failed", String(err));
    return null;
  }
}

/**
 * Channel analytics. Headline follower/subscriber counts come LIVE from Blaze
 * (`/v1/channels/stats`); activity/top-lists come from our Event log.
 */
export async function GET() {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const where = { channelId: r.channelId };

  const [stats, byKind, thanksAgg, voteAgg, topSupporters, topVoters, recent] = await Promise.all([
    liveStats(r.channelId),
    prisma.event.groupBy({ by: ["kind"], where, _count: { _all: true } }),
    prisma.event.aggregate({ where: { ...where, kind: "thanks" }, _sum: { amount: true } }),
    prisma.event.aggregate({ where: { ...where, kind: "vote" }, _sum: { amount: true } }),
    prisma.event.groupBy({
      by: ["actorName"],
      where: { ...where, kind: "thanks" },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.event.groupBy({
      by: ["actorName"],
      where: { ...where, kind: "vote" },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.event.findMany({ where, orderBy: { occurredAt: "desc" }, take: 20 }),
  ]);

  const counts = Object.fromEntries(byKind.map((k) => [k.kind, k._count._all]));
  return NextResponse.json({
    counts,
    live: stats, // real counts from Blaze, or null if unavailable
    thanksTotal: thanksAgg._sum.amount ?? 0,
    votesTotal: voteAgg._sum.amount ?? 0,
    topSupporters: topSupporters.map((s) => ({ name: s.actorName, amount: s._sum.amount ?? 0 })),
    topVoters: topVoters.map((s) => ({ name: s.actorName, amount: s._sum.amount ?? 0 })),
    recent: recent.map((e) => ({
      kind: e.kind,
      actorName: e.actorName,
      amount: e.amount,
      message: e.message,
      occurredAt: e.occurredAt,
    })),
  });
}
