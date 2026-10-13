ALTER TABLE "ImagePack" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true;
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY "productId" ORDER BY "createdAt" DESC, id) AS n FROM "ImagePack") UPDATE "ImagePack" p SET "isCurrent" = (r.n=1), version=r.n FROM ranked r WHERE p.id=r.id;
CREATE UNIQUE INDEX "ImagePack_current_product" ON "ImagePack"("productId") WHERE "isCurrent";
ALTER TABLE "ImageSlot" ADD COLUMN "name" TEXT NOT NULL DEFAULT '图位', ADD COLUMN "candidateCount" INTEGER NOT NULL DEFAULT 2, ADD COLUMN "aspectRatio" TEXT NOT NULL DEFAULT '1:1', ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ImageSlot" ADD CONSTRAINT "ImageSlot_candidateCount_check" CHECK ("candidateCount" BETWEEN 1 AND 4);
CREATE TABLE "GenerationBatch" (
  "id" TEXT PRIMARY KEY, "packId" TEXT NOT NULL REFERENCES "ImagePack"(id) ON DELETE RESTRICT,
  "createdById" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "slotCount" INTEGER NOT NULL, "totalCount" INTEGER NOT NULL,
  "estimatedCostUsd" DECIMAL(12,6) NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', "requestKey" TEXT NOT NULL UNIQUE
);
CREATE INDEX "GenerationBatch_packId_createdAt_idx" ON "GenerationBatch"("packId","createdAt");
ALTER TABLE "GenerationJob" ADD COLUMN "batchId" TEXT REFERENCES "GenerationBatch"(id) ON DELETE RESTRICT,
 ADD COLUMN "retryOfId" TEXT UNIQUE REFERENCES "GenerationJob"(id) ON DELETE RESTRICT;
CREATE INDEX "GenerationJob_batchId_idx" ON "GenerationJob"("batchId");
-- 批次状态随任务事务同步更新；重启后无需依赖浏览器内存。
CREATE FUNCTION refresh_generation_batch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT;
BEGIN
 target := COALESCE(NEW."batchId", OLD."batchId");
 IF target IS NOT NULL THEN
  UPDATE "GenerationBatch" SET status = CASE
    WHEN EXISTS(SELECT 1 FROM "GenerationJob" j WHERE j."batchId"=target AND j.status IN ('pending','running') AND NOT EXISTS(SELECT 1 FROM "GenerationJob" r WHERE r."retryOfId"=j.id)) THEN 'generating'
    WHEN EXISTS(SELECT 1 FROM "GenerationJob" j WHERE j."batchId"=target AND j.status IN ('failed','cancelled') AND NOT EXISTS(SELECT 1 FROM "GenerationJob" r WHERE r."retryOfId"=j.id)) THEN 'partial_failed'
    ELSE 'completed' END WHERE id=target;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER generation_batch_progress AFTER INSERT OR UPDATE OF status ON "GenerationJob" FOR EACH ROW EXECUTE FUNCTION refresh_generation_batch();
