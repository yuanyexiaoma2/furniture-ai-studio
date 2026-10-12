ALTER TYPE "JobStatus" RENAME VALUE 'succeeded' TO 'success';
ALTER TABLE "GenerationJob" ADD COLUMN "productId" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "nextPollAt" TIMESTAMP(3);
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "GenerationJob_productId_createdAt_idx" ON "GenerationJob"("productId", "createdAt");
CREATE TABLE "KieUpload" (
  "id" TEXT NOT NULL PRIMARY KEY, "url" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ProviderRateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY, "nextAllowedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "WorkerHeartbeat" (
  "id" TEXT NOT NULL PRIMARY KEY, "instanceId" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
