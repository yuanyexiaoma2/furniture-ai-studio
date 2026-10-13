ALTER TABLE "Asset" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deletedAt" TIMESTAMP(3);

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "productId" ORDER BY "createdAt", id) - 1 AS position
  FROM "Asset" WHERE type = 'photo'
)
UPDATE "Asset" SET "sortOrder" = ordered.position FROM ordered WHERE "Asset".id = ordered.id;

CREATE INDEX "Asset_productId_type_deletedAt_sortOrder_idx" ON "Asset"("productId", "type", "deletedAt", "sortOrder");
