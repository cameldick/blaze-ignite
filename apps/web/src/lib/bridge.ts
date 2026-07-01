import "server-only";
import { env } from "./env";

/**
 * Server -> bridge control calls (guarded by the shared internal secret).
 * Failures here are non-fatal to the user flow (the bridge re-subscribes all
 * channels on its next boot), so callers log and continue.
 */
async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${env.bridgeUrl}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-internal-secret": env.bridgeSecret },
    cache: "no-store",
  });
}

/** Tell the bridge to subscribe a newly-connected channel. */
export async function startChannelOnBridge(channelId: string): Promise<void> {
  await call(`/channels/${channelId}/start`, { method: "POST" });
}

/** Tell the bridge to hot-reload a channel's rules after an edit. */
export async function reloadRulesOnBridge(channelId: string): Promise<void> {
  await call(`/channels/${channelId}/rules/reload`, { method: "POST" });
}

/** Tell the bridge to re-broadcast a fresh overlay snapshot after a config edit. */
export async function refreshOverlays(channelId: string): Promise<void> {
  await call(`/channels/${channelId}/refresh`, { method: "POST" }).catch(() => {});
}

/** Preview an alert exactly as configured (per-alert dashboard Preview). */
export async function previewAlert(
  channelId: string,
  body: {
    eventKind: "thanks" | "follow" | "subscription" | "gift";
    text?: string;
    theme: string;
    animation: string;
    durationSec: number;
    amount?: number;
  },
): Promise<void> {
  await call(`/channels/${channelId}/preview-alert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/** Read the bridge's adapter status for a channel (diagnostics). */
export async function getChannelStatus(channelId: string): Promise<unknown> {
  try {
    const res = await call(`/channels/${channelId}/status`);
    return res.ok ? await res.json() : { status: null, error: `HTTP ${res.status}` };
  } catch (err) {
    return { status: null, error: String(err) };
  }
}

/** Fire a simulated Thanks for the dashboard "Test Event" button. */
export async function sendTestEvent(
  channelId: string,
  body: {
    kind?: "thanks" | "follow" | "subscription";
    amount?: number;
    actorName?: string;
    message?: string;
    preview?: boolean;
  },
): Promise<void> {
  await call(`/channels/${channelId}/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
