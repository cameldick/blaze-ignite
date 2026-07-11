import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@blaze-ignite/db";
import { oraclePoints } from "@blaze-ignite/shared";
import { requireChannelId } from "@/lib/api";
import { refreshOverlays } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const Patch = z.object({
  action: z.enum(["lock", "resolve"]),
  winningOptionId: z.string().optional(),
});

/** Lock (no more picks) or resolve (score the Oracle leaderboard) a prediction. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const pred = await prisma.prediction.findFirst({
    where: { id: params.id, channelId: r.channelId },
    include: { options: true, entries: true },
  });
  if (!pred) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.action === "lock") {
    if (pred.status === "open") {
      await prisma.prediction.update({ where: { id: pred.id }, data: { status: "locked" } });
      await refreshOverlays(r.channelId);
    }
    return NextResponse.json({ ok: true });
  }

  // resolve
  if (pred.status === "resolved") {
    return NextResponse.json({ error: "already_resolved" }, { status: 400 });
  }
  const winningOptionId = parsed.data.winningOptionId;
  if (!winningOptionId || !pred.options.some((o) => o.id === winningOptionId)) {
    return NextResponse.json({ error: "invalid winningOptionId" }, { status: 400 });
  }

  // Score every participant into the Oracle leaderboard (absolute values so it's
  // safe and bestStreak stays correct).
  for (const entry of pred.entries) {
    const correct = entry.optionId === winningOptionId;
    const existing = await prisma.oracle.findUnique({
      where: { channelId_actorId: { channelId: r.channelId, actorId: entry.actorId } },
    });
    const streak = correct ? (existing?.streak ?? 0) + 1 : 0;
    const data = {
      actorName: entry.actorName,
      points: (existing?.points ?? 0) + oraclePoints(correct, entry.stakeThanks),
      wins: (existing?.wins ?? 0) + (correct ? 1 : 0),
      losses: (existing?.losses ?? 0) + (correct ? 0 : 1),
      streak,
      bestStreak: Math.max(existing?.bestStreak ?? 0, streak),
    };
    await prisma.oracle.upsert({
      where: { channelId_actorId: { channelId: r.channelId, actorId: entry.actorId } },
      create: { channelId: r.channelId, actorId: entry.actorId, ...data },
      update: data,
    });
  }

  await prisma.prediction.update({
    where: { id: pred.id },
    data: { status: "resolved", winningOptionId },
  });
  await refreshOverlays(r.channelId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  await prisma.prediction.deleteMany({ where: { id: params.id, channelId: r.channelId } });
  await refreshOverlays(r.channelId);
  return NextResponse.json({ ok: true });
}
