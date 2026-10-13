import { z } from "zod";
export const slotTypes = ["main", "scene", "dimension", "selling_point", "detail", "installation"] as const;
export const packRatios = ["1:1", "3:4", "4:3", "16:9"] as const;
export const slotLabels: Record<typeof slotTypes[number], string> = { main: "主图", scene: "场景图", dimension: "尺寸图", selling_point: "卖点图", detail: "细节图", installation: "安装示意图" };
export const slotSchema = z.object({ name: z.string().trim().min(1, "请填写图位名称").max(80), slotType: z.enum(slotTypes), method: z.enum(["ai_scene", "manual_upload"]), goal: z.string().trim().max(8000), candidateCount: z.number().int().min(1).max(4), aspectRatio: z.enum(packRatios) });
export const defaultSlots = [
  { name: "主图", slotType: "main", method: "ai_scene" },
  { name: "客厅场景", slotType: "scene", method: "ai_scene" },
  { name: "卧室场景", slotType: "scene", method: "ai_scene" },
  { name: "其他空间场景", slotType: "scene", method: "ai_scene" },
  { name: "卖点图", slotType: "selling_point", method: "manual_upload" },
  { name: "细节图", slotType: "detail", method: "manual_upload" },
  { name: "安装示意图", slotType: "installation", method: "manual_upload" },
] as const;
export function eligibleSlots<T extends { method: string; goal: string }>(slots: T[]) { return slots.filter(s => s.method === "ai_scene" && s.goal.trim()); }
export function packFilename(sku: string, order: number, type: string) { return `${sku.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")}_${String(order).padStart(2, "0")}_${type}.png`; }
export function batchProgress(jobs: { status: string; retriedBy: unknown }[]) {
  const active = jobs.filter(j => !j.retriedBy), completed = active.filter(j => j.status === "success").length, failed = active.filter(j => ["failed", "cancelled"].includes(j.status)).length;
  return { completed, failed, total: active.length, status: active.some(j => ["pending", "running"].includes(j.status)) ? "generating" : failed ? "partial_failed" : "completed" };
}
