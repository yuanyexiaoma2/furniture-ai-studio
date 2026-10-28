CREATE TABLE "ReviewRound" (
 "id" TEXT NOT NULL,
 "productId" TEXT NOT NULL,
 "number" INTEGER NOT NULL,
 "planVersion" TEXT NOT NULL,
 "libraryEntryCount" INTEGER NOT NULL,
 "libraryEligibleCount" INTEGER NOT NULL,
 "snapshot" JSONB NOT NULL,
 "createdById" TEXT NOT NULL,
 "createdByName" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReviewRound_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReviewRating" (
 "id" TEXT NOT NULL,
 "roundId" TEXT NOT NULL,
 "slotKey" TEXT NOT NULL,
 "decision" TEXT NOT NULL,
 "reason" TEXT NOT NULL,
 "reviewerId" TEXT NOT NULL,
 "reviewerName" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReviewRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReviewRound_productId_number_key" ON "ReviewRound"("productId","number");
CREATE INDEX "ReviewRating_roundId_createdAt_idx" ON "ReviewRating"("roundId","createdAt");
ALTER TABLE "ReviewRound" ADD CONSTRAINT "ReviewRound_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRating" ADD CONSTRAINT "ReviewRating_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ReviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
