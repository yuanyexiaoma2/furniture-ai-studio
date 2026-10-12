-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'template_editor', 'designer', 'viewer');

-- CreateEnum
CREATE TYPE "Complexity" AS ENUM ('simple', 'complex');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('photo', 'white_bg', 'mask', 'depth', 'generated', 'final', 'style_ref');

-- CreateEnum
CREATE TYPE "PackStatus" AS ENUM ('draft', 'confirmed', 'generating', 'reviewing', 'completed');

-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('main', 'scene', 'dimension', 'selling_point', 'detail', 'installation');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'designer',
    "department" TEXT,
    "monthlyQuota" INTEGER NOT NULL DEFAULT 100,
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "materials" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "sellingPoints" JSONB NOT NULL,
    "complexity" "Complexity" NOT NULL DEFAULT 'simple',
    "identityTraits" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "type" "AssetType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagePack" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "PackStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageSlot" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "slotType" "SlotType" NOT NULL,
    "goal" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "finalAssetId" TEXT,

    CONSTRAINT "ImageSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "logicalModel" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "exampleAssetId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "slotId" TEXT,
    "logicalModel" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "input" JSONB NOT NULL,
    "externalTaskId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "cost" DECIMAL(12,6),
    "resultAssetIds" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_createdById_idx" ON "Product"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE INDEX "Asset_productId_type_idx" ON "Asset"("productId", "type");

-- CreateIndex
CREATE INDEX "Asset_createdById_idx" ON "Asset"("createdById");

-- CreateIndex
CREATE INDEX "ImagePack_productId_idx" ON "ImagePack"("productId");

-- CreateIndex
CREATE INDEX "ImageSlot_finalAssetId_idx" ON "ImageSlot"("finalAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageSlot_packId_order_key" ON "ImageSlot"("packId", "order");

-- CreateIndex
CREATE INDEX "Template_enabled_idx" ON "Template"("enabled");

-- CreateIndex
CREATE INDEX "Template_exampleAssetId_idx" ON "Template"("exampleAssetId");

-- CreateIndex
CREATE INDEX "GenerationJob_slotId_idx" ON "GenerationJob"("slotId");

-- CreateIndex
CREATE INDEX "GenerationJob_createdById_createdAt_idx" ON "GenerationJob"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_status_createdAt_idx" ON "GenerationJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_provider_externalTaskId_idx" ON "GenerationJob"("provider", "externalTaskId");

-- CreateIndex
CREATE INDEX "ChatMessage_productId_createdAt_idx" ON "ChatMessage"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagePack" ADD CONSTRAINT "ImagePack_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageSlot" ADD CONSTRAINT "ImageSlot_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ImagePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageSlot" ADD CONSTRAINT "ImageSlot_finalAssetId_fkey" FOREIGN KEY ("finalAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_exampleAssetId_fkey" FOREIGN KEY ("exampleAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ImageSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
