import { z } from "zod";
import { IMAGE_DEFAULTS, sceneAspectRatios, sceneResolutions } from "@/lib/models.config";

const text = (label: string, max: number) => z.string().trim().min(1, `请填写${label}`).max(max, `${label}内容过长`);
export const productSchema = z.object({
  sku: text("SKU", 100), name: text("商品名称", 200), category: text("品类", 100),
  dimensions: text("尺寸", 500), colors: text("颜色", 500), sellingPoints: text("卖点", 3000),
  materials: z.string().trim().max(500, "材质内容过长").default(""),
  complexity: z.enum(["simple", "complex"], { error: "请选择产品复杂度" }),
  identityTraits: z.string().trim().max(10000, "身份特征不能超过 10000 字符").default(""),
});
const generationOptions = {
  aspectRatio: z.enum(sceneAspectRatios, { error: "不支持该画面比例" }).default("1:1"),
  resolution: z.enum(sceneResolutions, { error: "请选择 1K、2K 或 4K 分辨率" }).default(IMAGE_DEFAULTS.resolution),
};
export const sceneSchema = z.object({ sceneIntent: text("场景意图", 8000), ...generationOptions });
export const editSchema = z.object({ sourceJobId: text("原图任务编号", 100), sourceAssetId: text("原图编号", 100), editIntent: text("修改要求", 8000), ...generationOptions });
export const photoOrderSchema = z.object({ photoIds: z.array(z.string().min(1).max(100)).min(1).max(3).refine((ids) => new Set(ids).size === ids.length, "排序列表不能包含重复图片") });
export type ProductFormData = z.infer<typeof productSchema>;
