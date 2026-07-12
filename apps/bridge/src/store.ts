import { prisma, Prisma } from "@blaze-ignite/db";
import {
  ActionRule,
  type NormalizedEvent,
  type Actor,
  type GoalStateMsg,
  type TipWarStateMsg,
  type BossStateMsg,
  type SpotlightStateMsg,
  type PredictionStateMsg,
  type OracleStateMsg,
  predictionPct,
  oraclePoints,
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
type Prediction = z.infer<typeof PredictionStateMsg>;
type Oracle = z.infer<typeof OracleStateMsg>;

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

// ── "Call It" Prediction Market ────────────────────────────────────────────

/** Build the overlay message for a prediction from its option rows. */
function buildPredictionMsg(
  pred: { id: string; title: string; status: string; winningOptionId: string | null },
  options: { id: string; label: string; backers: number; thanksTotal: number }[],
  winners?: { name: string; stakeThanks: number }[],
): Prediction {
  // Weight = participants + staked Thanks, so high-rollers move the odds.
  const pct = predictionPct(options);
  return {
    type: "prediction",
    id: pred.id,
    title: pred.title,
    status: (["open", "locked", "resolved"].includes(pred.status) ? pred.status : "open") as
      | "open"
      | "locked"
      | "resolved",
    options: options.map((o, i) => ({
      id: o.id,
      label: o.label,
      backers: o.backers,
      thanksTotal: o.thanksTotal,
      pct: pct[i]!,
    })),
    winningOptionId: pred.winningOptionId ?? undefined,
    winners,
  };
}

/** Top correct backers of a resolved prediction (for the on-screen reveal). */
async function topWinners(
  predictionId: string,
  winningOptionId: string | null,
): Promise<{ name: string; stakeThanks: number }[]> {
  if (!winningOptionId) return [];
  const entries = await prisma.predictionEntry.findMany({
    where: { predictionId, optionId: winningOptionId },
    orderBy: [{ stakeThanks: "desc" }, { createdAt: "asc" }],
    take: 8,
  });
  return entries.map((e) => ({ name: e.actorName, stakeThanks: e.stakeThanks }));
}

/** The channel's current prediction (most recent), as an overlay message. */
export async function loadPredictionState(channelId: string): Promise<Prediction | null> {
  const pred = await prisma.prediction.findFirst({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    include: { options: { orderBy: { id: "asc" } } },
  });
  if (!pred) return null;
  const winners = pred.status === "resolved" ? await topWinners(pred.id, pred.winningOptionId) : undefined;
  return buildPredictionMsg(pred, pred.options, winners);
}

/** Is a prediction currently open for picks? (cheap gate for chat volume) */
export async function hasOpenPrediction(channelId: string): Promise<boolean> {
  const n = await prisma.prediction.count({ where: { channelId, status: "open" } });
  return n > 0;
}

/**
 * Record a viewer's pick on the open prediction. Free picks come from chat
 * (stakeThanks=0); Thanks-backed picks add high-roller weight. The first pick
 * locks a viewer's side; later Thanks on the same side raise their stake, other
 * sides are ignored. Returns the updated state, or null if nothing changed.
 */
export async function recordPredictionPick(
  channelId: string,
  actor: Actor,
  message: string | undefined,
  stakeThanks: number,
): Promise<Prediction | null> {
  const pred = await prisma.prediction.findFirst({
    where: { channelId, status: "open" },
    orderBy: { createdAt: "desc" },
    include: { options: true },
  });
  if (!pred) return null;
  const text = (message ?? "").toLowerCase();
  const opt = pred.options.find((o) => o.keyword && text.includes(o.keyword.toLowerCase()));
  if (!opt) return null;

  const name = actor.displayName ?? actor.username;
  const existing = await prisma.predictionEntry.findUnique({
    where: { predictionId_actorId: { predictionId: pred.id, actorId: actor.id } },
  });
  if (!existing) {
    await prisma.predictionEntry.create({
      data: { predictionId: pred.id, optionId: opt.id, actorId: actor.id, actorName: name, stakeThanks },
    });
    await prisma.predictionOption.update({
      where: { id: opt.id },
      data: { backers: { increment: 1 }, ...(stakeThanks > 0 && { thanksTotal: { increment: stakeThanks } }) },
    });
  } else if (existing.optionId === opt.id && stakeThanks > 0) {
    await prisma.predictionEntry.update({
      where: { id: existing.id },
      data: { stakeThanks: { increment: stakeThanks } },
    });
    await prisma.predictionOption.update({
      where: { id: opt.id },
      data: { thanksTotal: { increment: stakeThanks } },
    });
  } else {
    return null; // side already locked to a different option, or free re-pick
  }
  return loadPredictionState(channelId);
}

/**
 * Score a batch of results into the Oracle leaderboard. Shared by prediction
 * resolves and market settles: a correct call banks points (base + staked
 * Thanks) and extends the streak; a wrong call resets the streak.
 */
export async function awardOracle(
  channelId: string,
  results: { actorId: string; actorName: string; correct: boolean; stakeThanks: number }[],
): Promise<void> {
  for (const r of results) {
    const existing = await prisma.oracle.findUnique({
      where: { channelId_actorId: { channelId, actorId: r.actorId } },
    });
    const streak = r.correct ? (existing?.streak ?? 0) + 1 : 0;
    const data = {
      actorName: r.actorName,
      points: (existing?.points ?? 0) + oraclePoints(r.correct, r.stakeThanks),
      wins: (existing?.wins ?? 0) + (r.correct ? 1 : 0),
      losses: (existing?.losses ?? 0) + (r.correct ? 0 : 1),
      streak,
      bestStreak: Math.max(existing?.bestStreak ?? 0, streak),
    };
    await prisma.oracle.upsert({
      where: { channelId_actorId: { channelId, actorId: r.actorId } },
      create: { channelId, actorId: r.actorId, ...data },
      update: data,
    });
  }
}

/** The Oracle leaderboard — top predictors on the channel. */
export async function loadOracle(channelId: string): Promise<Oracle> {
  const rows = await prisma.oracle.findMany({
    where: { channelId },
    orderBy: [{ points: "desc" }, { bestStreak: "desc" }],
    take: 10,
  });
  return {
    type: "oracle",
    leaders: rows.map((r) => ({ name: r.actorName, points: r.points, streak: r.streak, wins: r.wins })),
  };
}

/** Full overlay state snapshot for replay on (re)connect. */
export async function loadSnapshot(channelId: string): Promise<{
  goals: Goal[];
  wars: War[];
  bosses: Boss[];
  spotlight: Spotlight;
  prediction?: Prediction;
  oracle: Oracle;
}> {
  const [goals, wars, bosses, spotlight, prediction, oracle] = await Promise.all([
    prisma.goal.findMany({ where: { channelId, active: true } }),
    prisma.tipWar.findMany({ where: { channelId, active: true }, include: { options: true } }),
    prisma.boss.findMany({ where: { channelId, active: true } }),
    loadSpotlight(channelId),
    loadPredictionState(channelId),
    loadOracle(channelId),
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
    prediction: prediction ?? undefined,
    oracle,
  };
}
