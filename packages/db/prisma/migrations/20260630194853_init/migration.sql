-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "blazeId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "blazeChannelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "overlayToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorAddress" TEXT,
    "amount" DOUBLE PRECISION,
    "message" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRule" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "match" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipWar" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipWar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipWarOption" (
    "id" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyword" TEXT,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "TipWarOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boss" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxHp" DOUBLE PRECISION NOT NULL,
    "hp" DOUBLE PRECISION NOT NULL,
    "rewardText" TEXT,
    "defeated" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_blazeId_key" ON "User"("blazeId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_blazeChannelId_key" ON "Channel"("blazeChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_overlayToken_key" ON "Channel"("overlayToken");

-- CreateIndex
CREATE INDEX "Channel_userId_idx" ON "Channel"("userId");

-- CreateIndex
CREATE INDEX "Event_channelId_occurredAt_idx" ON "Event"("channelId", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_channelId_kind_idx" ON "Event"("channelId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Event_channelId_kind_sourceEventId_key" ON "Event"("channelId", "kind", "sourceEventId");

-- CreateIndex
CREATE INDEX "ActionRule_channelId_enabled_idx" ON "ActionRule"("channelId", "enabled");

-- CreateIndex
CREATE INDEX "Goal_channelId_active_idx" ON "Goal"("channelId", "active");

-- CreateIndex
CREATE INDEX "TipWar_channelId_active_idx" ON "TipWar"("channelId", "active");

-- CreateIndex
CREATE INDEX "TipWarOption_warId_idx" ON "TipWarOption"("warId");

-- CreateIndex
CREATE INDEX "Boss_channelId_active_idx" ON "Boss"("channelId", "active");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRule" ADD CONSTRAINT "ActionRule_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipWar" ADD CONSTRAINT "TipWar_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipWarOption" ADD CONSTRAINT "TipWarOption_warId_fkey" FOREIGN KEY ("warId") REFERENCES "TipWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boss" ADD CONSTRAINT "Boss_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
