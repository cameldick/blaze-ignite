import "server-only";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";

/**
 * Minimal session: an encrypted, httpOnly cookie holding the connected
 * channelId. Good enough for the single-channel creator flow; swap for a fuller
 * auth library during hardening.
 */
const SESSION_COOKIE = "bi_session";
const OAUTH_COOKIE = "bi_oauth"; // transient PKCE state during the auth round-trip

const baseCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setSession(channelId: string): void {
  cookies().set(SESSION_COOKIE, encrypt(channelId), { ...baseCookie, maxAge: 60 * 60 * 24 * 30 });
}

export function getSessionChannelId(): string | null {
  const c = cookies().get(SESSION_COOKIE)?.value;
  if (!c) return null;
  try {
    return decrypt(c);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}

export function setOAuthState(state: string, codeVerifier: string): void {
  cookies().set(OAUTH_COOKIE, encrypt(JSON.stringify({ state, codeVerifier })), {
    ...baseCookie,
    maxAge: 600,
  });
}

export function takeOAuthState(): { state: string; codeVerifier: string } | null {
  const c = cookies().get(OAUTH_COOKIE)?.value;
  if (!c) return null;
  cookies().delete(OAUTH_COOKIE);
  try {
    return JSON.parse(decrypt(c)) as { state: string; codeVerifier: string };
  } catch {
    return null;
  }
}
