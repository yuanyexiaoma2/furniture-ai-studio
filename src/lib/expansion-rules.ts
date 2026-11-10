import { z } from "zod";
import { StudioError } from "./studio-error";
import { imageRouteCandidates, kieImageSpec } from "./image-models";
import type { ModelCandidate } from "./models.config";

export const expansionSchema = z.object({
  width: z.number().int().min(1).max(16000), height: z.number().int().min(1).max(16000),
  offsetX: z.number().int().min(0).max(16000), offsetY: z.number().int().min(0).max(16000),
}).strict();
export type Expansion = z.infer<typeof expansionSchema>;
export type PreviewRect = { x: number; y: number; width: number; height: number };

export function validateExpansion(value: unknown, source: { width: number; height: number }): Expansion {
  const extent = expansionSchema.parse(value);
  if (extent.width * extent.height > 64_000_000) throw new StudioError("扩图画布不能超过6400万像素，请缩小范围");
  if (extent.offsetX + source.width > extent.width || extent.offsetY + source.height > extent.height) throw new StudioError("扩图范围必须完整包含原图，请调整边框");
  if (extent.width === source.width && extent.height === source.height) throw new StudioError("请将边框向原图外扩展");
  return extent;
}

// 预览坐标统一换算到原图像素；取整后仍完整包含原图。
export function expansionFromPreview(box: PreviewRect, source: PreviewRect, natural: { width: number; height: number }) {
  const scale = source.width / natural.width;
  return validateExpansion({
    width: Math.ceil(box.width / scale), height: Math.ceil(box.height / scale),
    offsetX: Math.round((source.x - box.x) / scale), offsetY: Math.round((source.y - box.y) / scale),
  }, natural);
}

export function containExpansion(box: PreviewRect, source: PreviewRect): PreviewRect {
  const x = Math.min(box.x, source.x), y = Math.min(box.y, source.y);
  return { x, y, width: Math.max(box.x + box.width, source.x + source.width) - x, height: Math.max(box.y + box.height, source.y + source.height) - y };
}

export function expansionAspectRatio(extent: Expansion, candidate: ModelCandidate) {
  const primary = imageRouteCandidates(candidate)[0];
  const ratios = primary && kieImageSpec(primary.model)?.ratios.filter(r => r !== "auto");
  if (!ratios?.length) throw new StudioError("当前模型未登记扩图可用比例，请选择已支持的生图模型");
  const target = extent.width / extent.height;
  // 自定义范围使用最接近的供应商比例生成，落盘再还原精确画布并覆盖原图。
  return ratios.reduce((best, ratio) => {
    const distance = (r: string) => { const [w, h] = r.split(":").map(Number); return Math.abs(Math.log(w / h / target)); };
    return distance(ratio) < distance(best) ? ratio : best;
  });
}
