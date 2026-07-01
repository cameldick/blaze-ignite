import "server-only";
import { env } from "./env";

/**
 * Server-only Blaze API client for the OAuth flow + identity lookup.
 *
 * Confirmed endpoints (dev.blaze.stream/docs). Token/response FIELD names are not
 * fully documented, so responses are parsed defensively (snake_case OR camelCase)
 * — this client is the single place to adjust if the live shapes differ.
 */

const pick = (o: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
};

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Blaze POST ${url} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

async function getJson(url: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    // Every /v1 request requires BOTH the Bearer token and the client-id header.
    headers: {
      authorization: `Bearer ${token}`,
      "client-id": env.clientId,
      accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Blaze GET ${url} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

export interface AuthUrl {
  url: string;
  state: string;
  codeVerifier: string;
}

/** Step 1: ask Blaze to generate the PKCE authorize URL. */
export async function generateAuthUrl(): Promise<AuthUrl> {
  const r = await postJson(`${env.oauthBase}/generate-auth-url`, {
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    redirectUri: env.redirectUri,
    scopes: env.scopes,
  });
  const url = pick(r, "url");
  const state = pick(r, "state");
  const codeVerifier = pick(r, "codeVerifier", "code_verifier");
  if (!url || !state || !codeVerifier) throw new Error("generate-auth-url: unexpected response");
  return { url, state, codeVerifier };
}

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

function parseTokens(r: Record<string, unknown>): Tokens {
  const accessToken = pick(r, "accessToken", "access_token");
  if (!accessToken) throw new Error("token response missing access token");
  const refreshToken = pick(r, "refreshToken", "refresh_token");
  const expiresInRaw = r.expiresIn ?? r.expires_in;
  const expiresIn = typeof expiresInRaw === "number" ? expiresInRaw : Number(expiresInRaw);
  const expiresAt = Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1000) : undefined;
  return { accessToken, refreshToken, expiresAt };
}

/** Step 3: exchange the authorization code for a user access token. */
export async function exchangeCode(code: string, codeVerifier: string): Promise<Tokens> {
  const r = await postJson(`${env.oauthBase}/token`, {
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    code,
    codeVerifier,
    redirectUri: env.redirectUri,
    grantType: "authorization_code",
  });
  return parseTokens(r);
}

/** Refresh an expired access token. */
export async function refreshToken(refresh: string): Promise<Tokens> {
  const r = await postJson(`${env.oauthBase}/refresh`, {
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    refreshToken: refresh,
  });
  return parseTokens(r);
}

export interface BlazeProfile {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

/** Unwrap a possible { data: {...} } / { user: {...} } envelope. */
function unwrap(r: Record<string, unknown>): Record<string, unknown> {
  for (const k of ["data", "user", "profile", "result"]) {
    const v = r[k];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return r;
}

/** GET /v1/users/profile — the authorized user's identity. */
export async function getProfile(token: string): Promise<BlazeProfile> {
  const raw = await getJson(`${env.restBase}/users/profile`, token);
  const p = unwrap(raw);
  const userId = pick(p, "userId", "id", "uuid");
  const username = pick(p, "username", "name", "handle", "displayName");
  if (!userId || !username) {
    console.warn("users/profile raw response:", JSON.stringify(raw));
    throw new Error(`users/profile: unexpected response (keys: ${Object.keys(raw).join(",")})`);
  }
  return {
    userId,
    username,
    displayName: pick(p, "displayName", "name"),
    avatarUrl: pick(p, "avatarUrl", "avatar", "image"),
  };
}

export interface BlazeChannel {
  id: string;
  displayName?: string;
}

export interface BlazeStats {
  followerCount?: number;
  subscriberCount?: number;
  viewerCount?: number;
}

const numField = (o: Record<string, unknown>, ...keys: string[]): number | undefined => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  }
  return undefined;
};

/** GET /v1/channels/stats — real follower/subscriber/viewer counts from Blaze. */
export async function getChannelStats(token: string): Promise<BlazeStats> {
  const raw = await getJson(`${env.restBase}/channels/stats`, token);
  const s = unwrap(raw);
  return {
    followerCount: numField(s, "followerCount", "followers"),
    subscriberCount: numField(s, "subscriberCount", "subscribers"),
    viewerCount: numField(s, "viewerCount", "viewers"),
  };
}

/**
 * GET /v1/channels with the user token → the user's own channel. No documented
 * "me" endpoint, so we take the first channel in the response (the authed user's).
 */
export async function getOwnChannel(token: string): Promise<BlazeChannel> {
  const r = await getJson(`${env.restBase}/channels`, token);
  // Accept a list under data/channels/items, a bare array, or a single object.
  const arr =
    (Array.isArray(r) && r) ||
    (Array.isArray(r.data) && r.data) ||
    (Array.isArray(r.channels) && r.channels) ||
    (Array.isArray(r.items) && r.items) ||
    null;
  const first = (arr ? arr[0] : unwrap(r)) as Record<string, unknown> | undefined;
  const id = first && pick(first, "id", "channelId", "uuid");
  if (!id) {
    console.warn("channels raw response:", JSON.stringify(r));
    throw new Error(`channels: could not determine channel id (keys: ${Object.keys(r).join(",")})`);
  }
  return { id, displayName: first ? pick(first, "displayName", "name") : undefined };
}
