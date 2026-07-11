-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "winningOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionOption" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "backers" INTEGER NOT NULL DEFAULT 0,
    "thanksTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PredictionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionEntry" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "stakeThanks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oracle" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oracle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prediction_channelId_status_idx" ON "Prediction"("channelId", "status");

-- CreateIndex
CREATE INDEX "PredictionOption_predictionId_idx" ON "PredictionOption"("predictionId");

-- CreateIndex
CREATE INDEX "PredictionEntry_predictionId_idx" ON "PredictionEntry"("predictionId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionEntry_predictionId_actorId_key" ON "PredictionEntry"("predictionId", "actorId");

-- CreateIndex
CREATE INDEX "Oracle_channelId_points_idx" ON "Oracle"("channelId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "Oracle_channelId_actorId_key" ON "Oracle"("channelId", "actorId");

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionOption" ADD CONSTRAINT "PredictionOption_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionEntry" ADD CONSTRAINT "PredictionEntry_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oracle" ADD CONSTRAINT "Oracle_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
