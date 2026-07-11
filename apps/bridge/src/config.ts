import "dotenv/config";
import { z } from "zod";

/** Fail-fast env validation. The bridge refuses to boot with bad config. */
const Env = z.object({
  DATABASE_URL: z.string().min(1),

  // Confirmed Blaze hosts (dev.blaze.stream/docs): three different bases.
  BLAZE_OAUTH_BASE: z.string().url().default("https://blaze.stream/bapi/oauth2"),
  BLAZE_REST_BASE: z.string().url().default("https://api.blaze.stream/v1"),
  BLAZE_WS_URL: z.string().url().default("https://blaze.stream"),
  BLAZE_WS_PATH: z.string().default("/ws"),
  // Needed to refresh expired user tokens.
  BLAZE_CLIENT_ID: z.string().optional(),
  BLAZE_CLIENT_SECRET: z.string().optional(),

  EVENT_ADAPTER_MODE: z.enum(["socketio", "polling", "auto"]).default("auto"),
  POLLING_INTERVAL_MS: z.coerce.number().int().positive().default(4000),

  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  BRIDGE_PORT: z.coerce.number().int().positive().default(4000),
  BRIDGE_INTERNAL_SECRET: z.string().min(1),

  NODE_ENV: z.string().default("development"),
});

export const config = Env.parse(process.env);
export type Config = z.infer<typeof Env>;

/** Event types we subscribe to (Blaze subscriptionType names). */
export const SUBSCRIBED_EVENT_TYPES = [
  "channel.thanks",
  "channel.vote",
  "channel.subscribe",
  "channel.subscription.gift",
  "channel.follow",
  "channel.chat.message",
  "stream.online",
  "stream.offline",
] as const;
