import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { refreshOverlays } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const Body = z.object({
  title: z.string().min(1),
  options: z
    .array(z.object({ label: z.string().min(1), keyword: z.string().min(1) }))
    .min(2)
    .max(6),
});

/** Open a new "Call It" prediction. Only one may be open/locked at a time. */
export async function POST(req: NextRequest) {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const active = await prisma.prediction.findFirst({
    where: { channelId: r.channelId, status: { in: ["open", "locked"] } },
  });
  if (active) {
    return NextResponse.json(
      { error: "Resolve or delete the current prediction first." },
      { status: 409 },
    );
  }

  const pred = await prisma.prediction.create({
    data: {
      channelId: r.channelId,
      title: parsed.data.title,
      status: "open",
      options: { create: parsed.data.options.map((o) => ({ label: o.label, keyword: o.keyword })) },
    },
    include: { options: true },
  });
  await refreshOverlays(r.channelId);
  return NextResponse.json(pred);
}
