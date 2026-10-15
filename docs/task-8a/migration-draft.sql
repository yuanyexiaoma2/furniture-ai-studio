-- 任务 8A 讨论草案：不在 prisma/migrations 中，不执行、不修改现有数据库。
-- 8B 审阅后以 Prisma 迁移实现；现有 Product.category / Template 保留兼容。
BEGIN;
CREATE TYPE "LibraryVisibility" AS ENUM ('private','pending','public');
CREATE TYPE "ShootingMode" AS ENUM ('quick','strict');
CREATE TYPE "LibraryKind" AS ENUM ('category','scene','prop','set','reference','snippet','recipe');
CREATE TYPE "ShotAngle" AS ENUM ('front','quarter','side','back','top','material','hardware','legs','inside','joint');
CREATE TABLE "LibraryEntry" (
 "id" TEXT PRIMARY KEY, "shortCode" VARCHAR(24) UNIQUE NOT NULL,
 "kind" "LibraryKind" NOT NULL, "name" TEXT NOT NULL,
 "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "visibility" "LibraryVisibility" NOT NULL DEFAULT 'private',
 "tags" TEXT[] NOT NULL DEFAULT '{}', "used" INTEGER NOT NULL DEFAULT 0 CHECK ("used">=0),
 "liked" INTEGER NOT NULL DEFAULT 0 CHECK ("liked">=0),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK ("shortCode" ~ '^[A-Z][A-Z0-9]{0,23}$')
);
CREATE INDEX "LibraryEntry_tags_gin" ON "LibraryEntry" USING GIN ("tags");
CREATE INDEX "LibraryEntry_visibility_owner" ON "LibraryEntry" ("visibility","ownerId","kind");
CREATE TABLE "LibraryCategory" (
 "entryId" TEXT PRIMARY KEY REFERENCES "LibraryEntry"("id") ON DELETE RESTRICT,
 "defaultShootingMode" "ShootingMode" NOT NULL DEFAULT 'quick', "quickHint" TEXT NOT NULL
);
CREATE TABLE "ShotRequirement" (
 "categoryId" TEXT NOT NULL REFERENCES "LibraryCategory"("entryId") ON DELETE CASCADE,
 "angle" "ShotAngle" NOT NULL, "required" BOOLEAN NOT NULL DEFAULT TRUE, "hint" TEXT NOT NULL,
 PRIMARY KEY ("categoryId","angle")
);
CREATE TABLE "LibraryEntryCategory" (
 "entryId" TEXT NOT NULL REFERENCES "LibraryEntry"("id") ON DELETE CASCADE,
 "categoryId" TEXT NOT NULL REFERENCES "LibraryCategory"("entryId") ON DELETE RESTRICT,
 PRIMARY KEY ("entryId","categoryId")
);
CREATE TABLE "LibraryProductProfile" (
 "productId" TEXT PRIMARY KEY REFERENCES "Product"("id") ON DELETE CASCADE,
 "categoryId" TEXT NOT NULL REFERENCES "LibraryCategory"("entryId") ON DELETE RESTRICT,
 "shootingMode" "ShootingMode" NOT NULL DEFAULT 'quick',
 "dimensions" JSONB NOT NULL, "visibility" "LibraryVisibility" NOT NULL DEFAULT 'private'
);
-- 档位/提示去重属于任务会话，避免同 SKU 新任务被上一任务的提示状态污染。
CREATE TABLE "ShootingSession" (
 "sessionId" TEXT PRIMARY KEY REFERENCES "AgentSession"("id") ON DELETE CASCADE,
 "mode" "ShootingMode" NOT NULL, "quickHintSeen" BOOLEAN NOT NULL DEFAULT FALSE,
 "strictSkipped" BOOLEAN NOT NULL DEFAULT FALSE, "singlePhotoAcknowledged" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE "LockedFeature" (
 "productId" TEXT NOT NULL REFERENCES "LibraryProductProfile"("productId") ON DELETE CASCADE,
 "key" TEXT NOT NULL, "value" TEXT NOT NULL, "locked" BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY ("productId","key")
);
CREATE TABLE "ProductPhotoAnnotation" (
 "assetId" TEXT PRIMARY KEY REFERENCES "Asset"("id") ON DELETE RESTRICT,
 "productId" TEXT NOT NULL REFERENCES "LibraryProductProfile"("productId") ON DELETE CASCADE,
 "angle" "ShotAngle" NOT NULL, "angleSource" TEXT NOT NULL CHECK ("angleSource" IN ('vision','manual')),
 "original" BOOLEAN NOT NULL DEFAULT TRUE CHECK ("original")
);
-- 必须保证 annotation 对应当前产品、未删除且 type=photo，不能将生成图冒充实拍。
CREATE FUNCTION assert_original_photo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "Asset" a WHERE a.id=NEW."assetId" AND a."productId"=NEW."productId" AND a.type='photo' AND a."deletedAt" IS NULL)
 THEN RAISE EXCEPTION 'Original live product photograph required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER original_photo_guard BEFORE INSERT OR UPDATE ON "ProductPhotoAnnotation" FOR EACH ROW EXECUTE FUNCTION assert_original_photo();
CREATE TABLE "LibraryScene" (
 "entryId" TEXT PRIMARY KEY REFERENCES "LibraryEntry"("id") ON DELETE RESTRICT,
 "skeleton" TEXT NOT NULL, "fixed" JSONB NOT NULL, "variables" JSONB NOT NULL,
 "coverAssetId" TEXT NOT NULL REFERENCES "Asset"("id") ON DELETE RESTRICT,
 "sourceRecipeId" TEXT
);
CREATE TABLE "LibraryProp" (
 "entryId" TEXT PRIMARY KEY REFERENCES "LibraryEntry"("id") ON DELETE RESTRICT,
 "keywordsEn" TEXT NOT NULL, "shape" TEXT NOT NULL, "color" TEXT NOT NULL, "material" TEXT NOT NULL,
 "size" TEXT NOT NULL CHECK ("size" IN ('小','中','大')),
 "sceneTags" TEXT[] NOT NULL, "categoryTags" TEXT[] NOT NULL
);
CREATE TABLE "PropReferenceAsset" (
 "propId" TEXT NOT NULL REFERENCES "LibraryProp"("entryId") ON DELETE CASCADE,
 "assetId" TEXT NOT NULL REFERENCES "Asset"("id") ON DELETE RESTRICT, PRIMARY KEY ("propId","assetId")
);
CREATE TABLE "LibraryPropSet" (
 "entryId" TEXT PRIMARY KEY REFERENCES "LibraryEntry"("id") ON DELETE RESTRICT,
 "maxPick" INTEGER NOT NULL CHECK ("maxPick">0)
);
CREATE TABLE "PropSetMember" (
 "setId" TEXT NOT NULL REFERENCES "LibraryPropSet"("entryId") ON DELETE CASCADE,
 "propId" TEXT NOT NULL REFERENCES "LibraryProp"("entryId") ON DELETE RESTRICT, PRIMARY KEY ("setId","propId")
);
CREATE TABLE "SceneDefaultPropSet" (
 "sceneId" TEXT NOT NULL REFERENCES "LibraryScene"("entryId") ON DELETE CASCADE,
 "setId" TEXT NOT NULL REFERENCES "LibraryPropSet"("entryId") ON DELETE RESTRICT, PRIMARY KEY ("sceneId","setId")
);
CREATE TABLE "LibraryReference" (
 "entryId" TEXT PRIMARY KEY REFERENCES "LibraryEntry"("id") ON DELETE RESTRICT,
 "assetId" TEXT NOT NULL REFERENCES "Asset"("id") ON DELETE RESTRICT, "source" TEXT NOT NULL,
 "spaceTag" TEXT NOT NULL, "styleTag" TEXT NOT NULL, "lightingTag" TEXT NOT NULL,
 "categoryTags" TEXT[] NOT NULL, "score" INTEGER NOT NULL CHECK ("score" BETWEEN 0 AND 100)
);
CREATE TABLE "LibrarySnippet" (
 "entryId" TEXT PRIMARY KEY REFERENCES "LibraryEntry"("id") ON DELETE RESTRICT,
 "text" TEXT NOT NULL, "usageCount" INTEGER NOT NULL DEFAULT 0 CHECK ("usageCount">=0)
);
CREATE TABLE "LibraryRecipe" (
 "entryId" TEXT PRIMARY KEY REFERENCES "LibraryEntry"("id") ON DELETE RESTRICT,
 "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
 "categoryId" TEXT NOT NULL REFERENCES "LibraryCategory"("entryId") ON DELETE RESTRICT,
 "templateId" TEXT NOT NULL REFERENCES "LibraryScene"("entryId") ON DELETE RESTRICT,
 "imageAssetId" TEXT NOT NULL REFERENCES "Asset"("id") ON DELETE RESTRICT,
 "model" TEXT NOT NULL, "variables" JSONB NOT NULL, "finalPrompt" TEXT NOT NULL,
 "combinationKey" TEXT NOT NULL, "productSnapshot" JSONB NOT NULL, "templateSnapshot" JSONB NOT NULL,
 "parentRecipeId" TEXT REFERENCES "LibraryRecipe"("entryId") ON DELETE RESTRICT,
 "userInstruction" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE "LibraryScene" ADD CONSTRAINT scene_source_recipe_fk FOREIGN KEY ("sourceRecipeId") REFERENCES "LibraryRecipe"("entryId") ON DELETE RESTRICT;
-- 相同组合允许美工明确要求再次生成；不能 UNIQUE。去重由规划器查询判断。
CREATE INDEX "LibraryRecipe_product_date" ON "LibraryRecipe" ("productId","createdAt" DESC);
CREATE INDEX "LibraryRecipe_category_date" ON "LibraryRecipe" ("categoryId","createdAt" DESC);
CREATE INDEX "LibraryRecipe_combination" ON "LibraryRecipe" ("combinationKey");
CREATE TABLE "RecipeProp" (
 "recipeId" TEXT NOT NULL REFERENCES "LibraryRecipe"("entryId") ON DELETE RESTRICT,
 "propId" TEXT NOT NULL REFERENCES "LibraryProp"("entryId") ON DELETE RESTRICT, PRIMARY KEY ("recipeId","propId")
);
CREATE TABLE "RecipeReference" (
 "recipeId" TEXT NOT NULL REFERENCES "LibraryRecipe"("entryId") ON DELETE RESTRICT,
 "refId" TEXT NOT NULL REFERENCES "LibraryReference"("entryId") ON DELETE RESTRICT, PRIMARY KEY ("recipeId","refId")
);
CREATE TABLE "RecipeOriginalPhoto" (
 "recipeId" TEXT NOT NULL REFERENCES "LibraryRecipe"("entryId") ON DELETE RESTRICT,
 "assetId" TEXT NOT NULL REFERENCES "ProductPhotoAnnotation"("assetId") ON DELETE RESTRICT, PRIMARY KEY ("recipeId","assetId")
);
CREATE FUNCTION require_recipe_original() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "RecipeOriginalPhoto" o
 JOIN "ProductPhotoAnnotation" p ON p."assetId"=o."assetId"
 JOIN "Asset" a ON a.id=p."assetId"
 WHERE o."recipeId"=NEW."entryId" AND p."productId"=NEW."productId" AND a.type='photo' AND a."deletedAt" IS NULL)
 THEN RAISE EXCEPTION 'Recipe requires original photograph of the same product'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER recipe_original_required AFTER INSERT ON "LibraryRecipe" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_recipe_original();
-- 配方与三个关联表只允许 INSERT/SELECT；由未来服务账号权限保证，修改产生新配方。
-- 删除/改动已被配方引用的原始 Asset 必须受服务端归档策略保护，不能软删除后丢失身份参考。
CREATE TABLE "LibraryReview" (
 "id" TEXT PRIMARY KEY, "entryId" TEXT NOT NULL REFERENCES "LibraryEntry"("id") ON DELETE RESTRICT,
 "reviewerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "decision" TEXT NOT NULL CHECK ("decision" IN ('approve','return')), "note" TEXT,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "CapturePreference" (
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "kind" "LibraryKind" NOT NULL, "suppressed" BOOLEAN NOT NULL DEFAULT FALSE, PRIMARY KEY ("userId","kind")
);
-- 8B 必须用受限服务账号 / RLS 实现：
-- SELECT: public OR owner=current_user OR role IN(admin,template_editor)。
-- INSERT: owner=当前用户且 visibility=private；private->pending 仅所有者。
-- pending->public/private 仅 admin/template_editor，状态变更与 LibraryReview 同事务。
-- 所有短码先按当前任务解析，再校验表类型、产品/团队范围与可见性；不要信任 LLM 传入的 ID。
-- 费用报价、用户确认、幂等键和原始实拍校验须在真正付费提交前重新验证。
ROLLBACK; -- 刻意回滚：此文件仅供审阅，不作为可执行生产迁移交付。
