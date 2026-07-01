import "server-only";

/**
 * Server-only env accessor for the web app. Throws on missing required values so
 * misconfiguration fails fast in a route handler rather than silently.
 */
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  // Blaze
  oauthBase: process.env.BLAZE_OAUTH_BASE ?? "https://blaze.stream/bapi/oauth2",
  restBase: process.env.BLAZE_REST_BASE ?? "https://api.blaze.stream/v1",
  get clientId() {
    return req("BLAZE_CLIENT_ID");
  },
  get clientSecret() {
    return req("BLAZE_CLIENT_SECRET");
  },
  redirectUri: process.env.BLAZE_REDIRECT_URI ?? "http://localhost:3000/api/auth/blaze/callback",
  scopes: (process.env.BLAZE_SCOPES ?? "users.read offline.access channel.moderate users.bot")
    .split(/\s+/)
    .filter(Boolean),

  // Crypto / session
  get tokenKey() {
    return req("TOKEN_ENCRYPTION_KEY");
  },
  get sessionSecret() {
    return req("AUTH_SESSION_SECRET");
  },

  // Bridge (server -> bridge control calls)
  bridgeUrl: process.env.BRIDGE_URL ?? process.env.NEXT_PUBLIC_BRIDGE_URL ?? "http://localhost:4000",
  get bridgeSecret() {
    return req("BRIDGE_INTERNAL_SECRET");
  },

  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};
