import { prisma, Prisma } from "@blaze-ignite/db";
import {
  ActionRule,
  type NormalizedEvent,
  type GoalStateMsg,
  type TipWarStateMsg,
  type BossStateMsg,
  type SpotlightStateMsg,
} from "@blaze-ignite/shared";
import { z } from "zod";
import { config } from "./config.js";
import { decryptToken, encryptToken } from "./crypto.js";
import { refreshTokens } from "./blazeOAuth.js";
import { log } from "./log.js";

type Goal = z.infer<typeof GoalStateMsg>;
type War = z.infer<typeof TipWarStateMsg>;
type Boss = z.infer<typeof BossStateMsg>;
type Spotlight = z.infer<typeof SpotlightStateMsg>;

export interface LoadedChannel {
  channelId: string; // internal
  blazeChannelId: string;
  accessToken: string; // decrypted
  overlayToken: string;
  /** When the access token expires — drives proactive re-subscription. */
  tokenExpiresAt: Date | null;
}

function toLoaded(c: {
  id: string;
  blazeChannelId: string;
  accessTokenEnc: string;
  overlayToken: string;
  tokenExpiresAt: Date | null;
}): LoadedChannel {
  return {
    channelId: c.id,
    blazeChannelId: c.blazeChannelId,
    accessToken: decryptToken(c.accessTokenEnc),
    overlayToken: c.overlayToken,
    tokenExpiresAt: c.tokenExpiresAt,
  };
}

/** All channel ids to subscribe at boot. */
export async function loadChannelIds(): Promise<string[]> {
  return (await prisma.channel.findMany({ select: { id: true } })).map((c) => c.id);
}

/**
 * Load one channel with a guaranteed-fresh access token: if the stored token is
 * expired (or within 60s of it) and a refresh token exists, refresh via Blaze,
 * persist the new encrypted tokens, and return the fresh access token.
 */
export async function loadChannelFresh(channelId: string): Promise<LoadedChannel | null> {
  const c = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!c) return null;

  // Refresh a few minutes early so a scheduled re-subscribe always gets a fresh
  // token (well within the ~24h token lifetime).
  const soon = Date.now() + 5 * 60_000;
  const expired = c.tokenExpiresAt ? c.tokenExpiresAt.getTime() < soon : false;
  if (expired && c.refreshTokenEnc && config.BLAZE_CLIENT_ID) {
    try {
      const fresh = await refreshTokens(decryptToken(c.refreshTokenEnc));
      const updated = await prisma.channel.update({
        where: { id: c.id },
        data: {
          accessTokenEnc: encryptToken(fresh.accessToken),
          refreshTokenEnc: fresh.refreshToken ? encryptToken(fresh.refreshToken) : c.refreshTokenEnc,
          tokenExpiresAt: fresh.expiresAt,
        },
      });
      log.info("refreshed channel token", { channelId: c.id });
      return toLoaded(updated);
    } catch (err) {
      log.warn("token refresh failed; using stored token", { channelId: c.id, err: String(err) });
    }
  }
  return toLoaded(c);
}

/**
 * Idempotent event persistence. Returns isNew=false if this (channel, kind,
 * sourceEventId) was already recorded — the caller then skips firing actions.
 */
export async function persistEvent(event: NormalizedEvent): Promise<{ isNew: boolean }> {
  const hasActor = "actor" in event;
  const hasAmount = "amount" in event;
  try {
    await prisma.event.create({
      data: {
        channelId: event.channelId,
        sourceEventId: event.sourceEventId,
        kind: event.kind,
        actorId: hasActor ? event.actor.id : undefined,
        actorName: hasActor ? event.actor.username : undefined,
        actorAddress: hasActor ? event.actor.address : undefined,
        amount: hasAmount ? event.amount : undefined,
        message: "message" in event ? event.message : undefined,
        occurredAt: new Date(event.occurredAt),
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
    return { isNew: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { isNew: false }; // duplicate — already processed
    }
    throw err;
  }
}

export async function loadRules(channelId: string): Promise<ActionRule[]> {
  const rows = await prisma.actionRule.findMany({
    where: { channelId, enabled: true },
    orderBy: { priority: "asc" },
  });
  const rules: ActionRule[] = [];
  for (const r of rows) {
    const parsed = ActionRule.safeParse({
      id: r.id,
      channelId: r.channelId,
      enabled: r.enabled,
      priority: r.priority,
      match: r.match,
      action: r.action,
    });
    if (parsed.success) rules.push(parsed.data);
    else log.warn("skipping invalid rule", { ruleId: r.id, err: parsed.error.message });
  }
  return rules;
}

export async function addToGoal(goalId: string, amount: number): Promise<Goal | null> {
  const g = await prisma.goal.update({
    where: { id: goalId },
    data: { current: { increment: amount } },
  });
  return { type: "goal", goalId: g.id, title: g.title, current: g.current, target: g.target };
}

export async function addToWarOption(optionId: string, amount: number): Promise<War | null> {
  const opt = await prisma.tipWarOption.update({
    where: { id: optionId },
    data: { total: { increment: amount } },
    include: { war: { include: { options: true } } },
  });
  const war = opt.war;
  return {
    type: "tipwar",
    warId: war.id,
    title: war.title,
    options: war.options.map((o) => ({ id: o.id, label: o.label, total: o.total })),
  };
}

/**
 * Resolve which tip-war option a thanks funds. If the rule fixed an option, use
 * it. Otherwise match a configured keyword in the thanks message, falling back
 * to the first option so support is never silently dropped.
 */
export async function resolveWarOptionId(
  warId: string,
  fixedOptionId: string | undefined,
  message: string | undefined,
): Promise<string | null> {
  if (fixedOptionId) return fixedOptionId;
  const options = await prisma.tipWarOption.findMany({ where: { warId } });
  if (options.length === 0) return null;
  const text = (message ?? "").toLowerCase();
  const byKeyword = options.find((o) => o.keyword && text.includes(o.keyword.toLowerCase()));
  return (byKeyword ?? options[0])!.id;
}

export async function damageBoss(
  bossId: string,
  damage: number,
  actorName: string,
): Promise<Boss | null> {
  const boss = await prisma.boss.findUnique({ where: { id: bossId } });
  if (!boss) return null;
  const hp = Math.max(0, boss.hp - damage);
  const defeated = hp <= 0;
  const updated = await prisma.boss.update({ where: { id: bossId }, data: { hp, defeated } });
  return {
    type: "boss",
    bossId: updated.id,
    name: updated.name,
    hp: updated.hp,
    maxHp: updated.maxHp,
    lastHit: { actorName, damage },
    defeated: updated.defeated,
  };
}

/** Most recent Monday 00:00 UTC — start of the current Backstage epoch window. */
function epochStart(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const back = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - back);
  return d;
}

/** Backstage Spotlight standing for the current epoch, computed from votes. */
export async function loadSpotlight(channelId: string): Promise<Spotlight> {
  const votes = await prisma.event.findMany({
    where: { channelId, kind: "vote", occurredAt: { gte: epochStart() } },
    orderBy: { occurredAt: "asc" },
  });
  const byVoter = new Map<string, { name: string; address?: string; amount: number }>();
  let epochTotal = 0;
  for (const v of votes) {
    const amt = v.amount ?? 0;
    epochTotal += amt;
    const key = v.actorId ?? v.actorName ?? "anon";
    const prev = byVoter.get(key);
    byVoter.set(key, {
      name: v.actorName ?? "anonymous",
      address: v.actorAddress ?? undefined,
      amount: (prev?.amount ?? 0) + amt,
    });
  }
  const topVoters = [...byVoter.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
  return { type: "spotlight", epochTotal, topVoters };
}

/** Full overlay state snapshot for replay on (re)connect. */
export async function loadSnapshot(channelId: string): Promise<{
  goals: Goal[];
  wars: War[];
  bosses: Boss[];
  spotlight: Spotlight;
}> {
  const [goals, wars, bosses, spotlight] = await Promise.all([
    prisma.goal.findMany({ where: { channelId, active: true } }),
    prisma.tipWar.findMany({ where: { channelId, active: true }, include: { options: true } }),
    prisma.boss.findMany({ where: { channelId, active: true } }),
    loadSpotlight(channelId),
  ]);
  return {
    goals: goals.map((g) => ({
      type: "goal",
      goalId: g.id,
      title: g.title,
      current: g.current,
      target: g.target,
    })),
    wars: wars.map((w) => ({
      type: "tipwar",
      warId: w.id,
      title: w.title,
      options: w.options.map((o) => ({ id: o.id, label: o.label, total: o.total })),
    })),
    bosses: bosses.map((b) => ({
      type: "boss",
      bossId: b.id,
      name: b.name,
      hp: b.hp,
      maxHp: b.maxHp,
      defeated: b.defeated,
    })),
    spotlight,
  };
}
