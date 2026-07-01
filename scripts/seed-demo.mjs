// Seed a demo channel with rules/goal/boss for local pipeline testing.
// Run: node --env-file=.env scripts/seed-demo.mjs
import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function encrypt(plain) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

const user = await prisma.user.upsert({
  where: { blazeId: "demo-user" },
  create: { blazeId: "demo-user", username: "demo_creator" },
  update: {},
});

const channel = await prisma.channel.upsert({
  where: { blazeChannelId: "demo-channel" },
  create: {
    blazeChannelId: "demo-channel",
    userId: user.id,
    displayName: "Demo Creator",
    accessTokenEnc: encrypt("dummy-token"),
    scopes: ["users.read"],
  },
  update: {},
});

// Wipe + reseed rules/goal/boss for a clean test.
await prisma.actionRule.deleteMany({ where: { channelId: channel.id } });
await prisma.actionRule.create({
  data: {
    channelId: channel.id,
    priority: 10,
    match: {},
    action: { type: "alert", theme: "ignite-dark", animation: "pop", durationSec: 6 },
  },
});

const boss = await prisma.boss.upsert({
  where: { id: `${channel.id}-boss` },
  create: { id: `${channel.id}-boss`, channelId: channel.id, name: "Cyber Dragon", maxHp: 500, hp: 500 },
  update: { hp: 500, defeated: false },
});
await prisma.actionRule.create({
  data: {
    channelId: channel.id,
    priority: 20,
    match: {},
    action: { type: "boss", bossId: boss.id, damagePerPoint: 1 },
  },
});

const goal = await prisma.goal.upsert({
  where: { id: `${channel.id}-goal` },
  create: { id: `${channel.id}-goal`, channelId: channel.id, title: "New mic fund", target: 1000, current: 0 },
  update: { current: 0 },
});
await prisma.actionRule.create({
  data: {
    channelId: channel.id,
    priority: 30,
    match: {},
    action: { type: "goal", goalId: goal.id },
  },
});

console.log(JSON.stringify({ channelId: channel.id, overlayToken: channel.overlayToken }, null, 2));
await prisma.$disconnect();
