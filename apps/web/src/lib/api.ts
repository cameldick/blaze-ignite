import "server-only";
import { NextResponse } from "next/server";
import { getSessionChannelId } from "./session";

/** Resolve the session's channelId or return a 401 Response to short-circuit. */
export function requireChannelId(): { channelId: string } | { error: NextResponse } {
  const channelId = getSessionChannelId();
  if (!channelId) return { error: NextResponse.json({ error: "not_connected" }, { status: 401 }) };
  return { channelId };
}
