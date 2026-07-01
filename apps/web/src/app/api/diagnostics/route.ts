import { NextResponse } from "next/server";
import { prisma } from "@blaze-ignite/db";
import { requireChannelId } from "@/lib/api";
import { getChannelStatus } from "@/lib/bridge";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Connection/health snapshot for the diagnostics page. */
export async function GET() {
  const r = requireChannelId();
  if ("error" in r) return r.error;
  const [channel, status] = await Promise.all([
    prisma.channel.findUnique({ where: { id: r.channelId } }),
    getChannelStatus(r.channelId),
  ]);
  return NextResponse.json({
    channel: channel
      ? {
          displayName: channel.displayName,
          scopes: channel.scopes,
          tokenExpiresAt: channel.tokenExpiresAt,
          overlayToken: channel.overlayToken,
        }
      : null,
    bridge: status,
    endpoints: { rest: env.restBase, ws: process.env.BLAZE_WS_URL ?? "https://blaze.stream" },
  });
}
