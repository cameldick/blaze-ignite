import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blaze-ignite/db";
import { exchangeCode, getProfile, getOwnChannel } from "@/lib/blaze";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { setSession, takeOAuthState } from "@/lib/session";
import { startChannelOnBridge } from "@/lib/bridge";

export const dynamic = "force-dynamic";

const fail = (msg: string) =>
  NextResponse.redirect(`${env.appUrl}/dashboard?error=${encodeURIComponent(msg.slice(0, 240))}`);

/**
 * OAuth callback: validate state → exchange code → look up identity (and, best
 * effort, the channel) → upsert User/Channel with encrypted tokens → open a
 * session → ask the bridge to subscribe → land on the dashboard.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const saved = takeOAuthState();

  // Surface Blaze-side errors passed back on the redirect.
  const blazeErr = params.get("error") ?? params.get("error_description");
  if (blazeErr) return fail(`Blaze returned: ${blazeErr}`);
  if (!code || !state) return fail("Missing code/state on callback.");
  if (!saved || saved.state !== state) return fail("State mismatch (session expired?). Try again.");

  // 1) Exchange the code for a user token.
  let accessToken: string;
  let refreshToken: string | undefined;
  let tokenExpiresAt: Date | undefined;
  try {
    const t = await exchangeCode(code, saved.codeVerifier);
    accessToken = t.accessToken;
    refreshToken = t.refreshToken;
    tokenExpiresAt = t.expiresAt;
  } catch (err) {
    console.error("token exchange failed", err);
    return fail(`Token exchange failed: ${String(err)}`);
  }

  // 2) Identity (required). Fail loudly if this doesn't work.
  let profile;
  try {
    profile = await getProfile(accessToken);
    console.info("oauth: profile ok", { userId: profile.userId, username: profile.username });
  } catch (err) {
    console.error("getProfile failed", err);
    return fail(`Could not read your Blaze profile: ${String(err)}`);
  }

  // 3) Channel id (best effort). If /channels is unavailable, fall back to the
  //    user id so login still completes; event subscription is debuggable later.
  let blazeChannelId = profile.userId;
  let displayName = profile.displayName ?? profile.username;
  try {
    const ch = await getOwnChannel(accessToken);
    blazeChannelId = ch.id;
    displayName = ch.displayName ?? displayName;
  } catch (err) {
    console.warn("getOwnChannel failed; using userId as channel id", String(err));
  }

  try {
    const user = await prisma.user.upsert({
      where: { blazeId: profile.userId },
      create: { blazeId: profile.userId, username: profile.username, avatarUrl: profile.avatarUrl },
      update: { username: profile.username, avatarUrl: profile.avatarUrl },
    });
    const channel = await prisma.channel.upsert({
      where: { blazeChannelId },
      create: {
        blazeChannelId,
        userId: user.id,
        displayName,
        accessTokenEnc: encrypt(accessToken),
        refreshTokenEnc: refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt,
        scopes: env.scopes,
      },
      update: {
        accessTokenEnc: encrypt(accessToken),
        refreshTokenEnc: refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt,
        scopes: env.scopes,
      },
    });

    // First-time connect: seed a default alert rule so Thanks show an alert
    // out of the box (creators can theme/remove it in the dashboard).
    const ruleCount = await prisma.actionRule.count({ where: { channelId: channel.id } });
    if (ruleCount === 0) {
      await prisma.actionRule.create({
        data: {
          channelId: channel.id,
          priority: 10,
          match: {},
          action: {
            type: "alert",
            theme: "ignite-dark",
            animation: "pop",
            durationSec: 6,
            on: ["thanks"],
            text: "Thanks {name} for {amount}! 🔥",
          },
        },
      });
    }

    setSession(channel.id);
    await startChannelOnBridge(channel.id).catch((e) => console.error("bridge start failed", e));
    return NextResponse.redirect(`${env.appUrl}/dashboard?connected=1`);
  } catch (err) {
    console.error("persist/connect failed", err);
    return fail(`Could not save your connection: ${String(err)}`);
  }
}
