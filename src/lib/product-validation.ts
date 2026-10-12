import { z } from "zod";
import { sceneAspectRatios } from "@/lib/models.config";

const text = (label: string, max: number) => z.string().trim().min(1, `请填写${label}`).max(max, `${label}内容过长`);
export const productSchema = z.object({
  sku: text("SKU", 100), name: text("商品名称", 200), category: text("品类", 100),
  dimensions: text("尺寸", 500), colors: text("颜色", 500), sellingPoints: text("卖点", 3000),
  materials: z.string().trim().max(500, "材质内容过长").default(""),
  complexity: z.enum(["simple", "complex"], { error: "请选择产品复杂度" }),
  identityTraits: z.string().trim().max(10000, "身份特征不能超过 10000 字符").default(""),
});
export const sceneSchema = z.object({ sceneIntent: text("场景意图", 8000), aspectRatio: z.enum(sceneAspectRatios, { error: "不支持该画面比例" }).default("1:1") });
export type ProductFormData = z.infer<typeof productSchema>;
