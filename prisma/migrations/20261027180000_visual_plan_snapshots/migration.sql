-- 模板库继续使用 StudioLibraryEntry；这里只增加产品研究缓存和确认后的图位快照。
ALTER TABLE "Product" ADD COLUMN "visualResearch" JSONB;
ALTER TABLE "ImageSlot" ADD COLUMN "visualPlan" JSONB;
