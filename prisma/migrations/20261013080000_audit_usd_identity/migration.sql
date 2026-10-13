-- AlterTable
ALTER TABLE "User" ALTER COLUMN "monthlyQuota" SET DEFAULT 0.5,
ALTER COLUMN "monthlyQuota" SET DATA TYPE DECIMAL(12,6);

-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "costUsd" DECIMAL(12,6),
ADD COLUMN     "credits" DECIMAL(12,6),
ADD COLUMN     "deadlineAt" TIMESTAMP(3),
ADD COLUMN     "reservedUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
ADD COLUMN     "workerInstanceId" TEXT;

-- AlterTable
ALTER TABLE "GenerationAttempt" ADD COLUMN     "billingChecks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "billingJson" JSONB,
ADD COLUMN     "billingState" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "costUsd" DECIMAL(12,6),
ADD COLUMN     "credits" DECIMAL(12,6),
ADD COLUMN     "externalGenerationId" TEXT,
ADD COLUMN     "nextBillingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LlmCall" ADD COLUMN     "billingChecks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "billingJson" JSONB,
ADD COLUMN     "billingState" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "costUsd" DECIMAL(12,6),
ADD COLUMN     "credits" DECIMAL(12,6),
ADD COLUMN     "externalGenerationId" TEXT,
ADD COLUMN     "nextBillingAt" TIMESTAMP(3),
ADD COLUMN     "reservedUsd" DECIMAL(12,6) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "KieUpload" ADD COLUMN     "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "WorkerHeartbeat" ADD COLUMN     "hostName" TEXT,
ADD COLUMN     "processId" INTEGER;

-- CreateTable
CREATE TABLE "ProductIdentityVersion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "savedById" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "historical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductIdentityVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductIdentityVersion_productId_savedAt_idx" ON "ProductIdentityVersion"("productId", "savedAt");

-- AddForeignKey
ALTER TABLE "ProductIdentityVersion" ADD CONSTRAINT "ProductIdentityVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIdentityVersion" ADD CONSTRAINT "ProductIdentityVersion_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 旧配额和预留的单位为积分；按已核实名义价值 $0.005/积分迁移。
UPDATE "User" SET "monthlyQuota"="monthlyQuota" * 0.005;
UPDATE "GenerationJob" SET "reservedUsd"="reservedCredits" * 0.005, credits=CASE WHEN "costCurrency"='credits' THEN cost END, "costUsd"=CASE WHEN "costCurrency"='credits' THEN cost * 0.005 WHEN "costCurrency"='USD' THEN cost END;
UPDATE "GenerationAttempt" SET credits=CASE WHEN currency='credits' THEN cost END, "costUsd"=CASE WHEN currency='credits' THEN cost * 0.005 WHEN currency='USD' THEN cost END;
UPDATE "LlmCall" SET credits=CASE WHEN currency='credits' THEN cost END, "costUsd"=CASE WHEN currency='credits' THEN cost * 0.005 WHEN currency='USD' THEN cost END;
-- 最近上传时刻由旧 23h 缓存到期时间反推，不能沿用第一次创建时刻。
UPDATE "KieUpload" SET "uploadedAt"="expiresAt" - INTERVAL '23 hours';
-- 迁移前无法可靠确定最后保存人，保留未知并显式标为历史记录。
INSERT INTO "ProductIdentityVersion" (id,"productId",text,"savedAt",historical) SELECT 'historical-' || id,id,COALESCE("identityTraits",''),"updatedAt",true FROM "Product";
