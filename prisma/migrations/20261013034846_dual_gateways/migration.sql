-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "costCurrency" TEXT,
ADD COLUMN     "costEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fallback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservedCredits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GenerationAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'running',
    "externalTaskId" TEXT,
    "durationMs" INTEGER,
    "cost" DECIMAL(12,6),
    "currency" TEXT,
    "costEstimated" BOOLEAN NOT NULL DEFAULT false,
    "usage" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmCall" (
    "id" TEXT NOT NULL,
    "logicalModel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'running',
    "durationMs" INTEGER,
    "cost" DECIMAL(12,6),
    "currency" TEXT,
    "costEstimated" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayCircuit" (
    "provider" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3),
    "openUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayCircuit_pkey" PRIMARY KEY ("provider")
);

-- CreateIndex
CREATE INDEX "GenerationAttempt_provider_createdAt_idx" ON "GenerationAttempt"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationAttempt_jobId_createdAt_idx" ON "GenerationAttempt"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_provider_createdAt_idx" ON "LlmCall"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_createdById_createdAt_idx" ON "LlmCall"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "GenerationAttempt" ADD CONSTRAINT "GenerationAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmCall" ADD CONSTRAINT "LlmCall_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmCall" ADD CONSTRAINT "LlmCall_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- 保留旧记录的月度积分预留；已完成调用进入历史调用账本。
UPDATE "GenerationJob" SET "reservedCredits" = COALESCE(cost, 0)::integer, "costCurrency" = CASE WHEN cost IS NOT NULL THEN 'credits' END, "costEstimated" = true;
INSERT INTO "GenerationAttempt" (id, "jobId", provider, model, fallback, status, "durationMs", cost, currency, "costEstimated", error, "externalTaskId", "createdAt", "completedAt")
SELECT 'historical-' || id, id, COALESCE(provider,'kie'), COALESCE(model,'nano-banana-2-1'), false, status::text,
 CASE WHEN "completedAt" IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))*1000)::integer END,
 cost, 'credits', true, error, "externalTaskId", "startedAt", "completedAt" FROM "GenerationJob" WHERE "startedAt" IS NOT NULL;
