import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NormalizedEvent } from "@blaze-ignite/shared";
import type { ChannelManager } from "./channelManager.js";
import { config } from "./config.js";
import { log } from "./log.js";

/** Body for the dashboard "Test Event" / per-alert Preview buttons. */
const TestBody = z.object({
  kind: z.enum(["thanks", "follow", "subscription", "gift"]).default("thanks"),
  amount: z.number().positive().default(50),
  actorName: z.string().default("Supporter"),
  message: z.string().optional(),
  /** Preview mode: fire alerts only, don't mutate goal/boss/war state. */
  preview: z.boolean().default(false),
});

/** Body for the per-alert dashboard Preview button. */
const PreviewAlertBody = z.object({
  eventKind: z.enum(["thanks", "follow", "subscription", "gift"]).default("thanks"),
  text: z.string().optional(),
  theme: z.string().default("ignite-dark"),
  animation: z.enum(["glow", "pulse", "slideIn", "pop"]).default("pop"),
  durationSec: z.number().positive().max(30).default(6),
  actorName: z.string().default("Supporter"),
  amount: z.number().optional(),
  fontSize: z.number().int().min(10).max(96).optional(),
  sound: z.string().optional(),
  volume: z.number().min(0).max(100).optional(),
});

/**
 * Internal control plane (web app → bridge). Guarded by a shared secret. Not
 * public; overlays use the Socket.IO hub, viewers never touch this.
 */
export function createControlApp(manager: ChannelManager): Express {
  const app = express();
  app.use(express.json());

  // Health is unauthenticated for load balancers / uptime checks.
  app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  // Everything below requires the internal secret.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.header("x-internal-secret") !== config.BRIDGE_INTERNAL_SECRET) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  });

  app.post("/channels/:id/start", async (req, res) => {
    await manager.startChannel(req.params.id);
    res.json({ ok: true });
  });

  app.post("/channels/:id/stop", async (req, res) => {
    await manager.stopChannel(req.params.id);
    res.json({ ok: true });
  });

  app.post("/channels/:id/rules/reload", async (req, res) => {
    await manager.reloadRules(req.params.id);
    res.json({ ok: true });
  });

  // Re-broadcast a fresh snapshot so overlays reflect config edits immediately.
  app.post("/channels/:id/refresh", async (req, res) => {
    await manager.refreshOverlays(req.params.id);
    res.json({ ok: true });
  });

  // Preview an alert exactly as configured in the dashboard (saved or not).
  app.post("/channels/:id/preview-alert", (req, res) => {
    const parsed = PreviewAlertBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    manager.previewAlert(req.params.id, parsed.data);
    res.json({ ok: true });
  });

  app.get("/channels/:id/status", (req, res) => {
    res.json({ status: manager.status(req.params.id) ?? null });
  });

  app.post("/channels/:id/test", async (req, res) => {
    const parsed = TestBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { kind, amount, actorName, message, preview } = parsed.data;
    const common = {
      sourceEventId: `test-${randomUUID()}`,
      channelId: req.params.id,
      occurredAt: new Date().toISOString(),
      actor: { id: "test", username: actorName, displayName: actorName },
    };
    const event: NormalizedEvent =
      kind === "thanks"
        ? { ...common, kind: "thanks", amount, message }
        : kind === "gift"
          ? { ...common, kind: "gift", amount }
          : kind === "subscription"
            ? { ...common, kind: "subscription" }
            : { ...common, kind: "follow" };
    // Always preview for non-thanks (they only alert); honor the flag for thanks.
    await manager.injectTest(event, kind === "thanks" ? preview : true);
    res.json({ ok: true });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error("control error", { err: String(err) });
    res.status(500).json({ error: "internal" });
  });

  return app;
}
