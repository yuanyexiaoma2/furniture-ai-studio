-- 新方案只替换当前生成选择，旧候选和终稿继续保留。
ALTER TABLE "ImagePack" ADD COLUMN "confirmedPlanId" TEXT;
