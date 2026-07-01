import { config } from "./config.js";

/** Minimal Blaze OAuth refresh for the bridge (keeps long-lived subscriptions alive). */
export interface RefreshedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

const str = (o: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
};

export async function refreshTokens(refreshToken: string): Promise<RefreshedTokens> {
  if (!config.BLAZE_CLIENT_ID || !config.BLAZE_CLIENT_SECRET) {
    throw new Error("BLAZE_CLIENT_ID/SECRET not set; cannot refresh token");
  }
  const res = await fetch(`${config.BLAZE_OAUTH_BASE}/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: config.BLAZE_CLIENT_ID,
      clientSecret: config.BLAZE_CLIENT_SECRET,
      refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const r = (await res.json()) as Record<string, unknown>;
  const accessToken = str(r, "accessToken", "access_token");
  if (!accessToken) throw new Error("refresh: missing access token");
  const expiresInRaw = r.expiresIn ?? r.expires_in;
  const expiresIn = typeof expiresInRaw === "number" ? expiresInRaw : Number(expiresInRaw);
  return {
    accessToken,
    refreshToken: str(r, "refreshToken", "refresh_token") ?? refreshToken,
    expiresAt: Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1000) : undefined,
  };
}
