import { z } from "zod";
export const profileFields = ["category", "structureAndParts", "dimensions", "colorsAndTextures", "hardware", "logosAndLabels", "driftWarnings", "sellingPoints", "targetAudience", "spacesAndStyles"] as const;
export const profileLabels: Record<typeof profileFields[number], string> = { category: "品类", structureAndParts: "结构与部件（含数量）", dimensions: "尺寸", colorsAndTextures: "颜色与材质纹理", hardware: "五金样式与位置", logosAndLabels: "Logo / 标签", driftWarnings: "易被 AI 改错的细节", sellingPoints: "核心卖点（按优先级）", targetAudience: "目标人群", spacesAndStyles: "适用空间与风格" };
export const requiredFields = profileFields.slice(0, 7);
export const sourceSchema = z.object({ kind: z.enum(["document", "message", "product", "image"]), id: z.string().min(1).max(200), quote: z.string().max(2000) }).strict();
export const profileFieldSchema = z.object({ value: z.string().max(4000), status: z.enum(["confirmed", "inferred", "missing"]), sources: z.array(sourceSchema).max(15), conflicts: z.array(z.object({ value: z.string().max(4000), source: sourceSchema }).strict()).max(10) }).strict().superRefine((field, ctx) => {
  if (field.status !== "missing" && (!field.value.trim() || !field.sources.length)) ctx.addIssue({ code: "custom", message: "非缺失字段必须有值及来源" });
  if (field.conflicts.length && field.status === "confirmed") ctx.addIssue({ code: "custom", message: "冲突字段不能标为已确认" });
});
export const profileSchema = z.object(Object.fromEntries(profileFields.map(key => [key, profileFieldSchema])) as Record<typeof profileFields[number], typeof profileFieldSchema>).strict();
export type Profile = z.infer<typeof profileSchema>;
export function emptyProfile(): Profile { return Object.fromEntries(profileFields.map(key => [key, { value: "", status: "missing", sources: [], conflicts: [] }])) as unknown as Profile; }
export function understanding(profile: Profile) {
  const confirmed = requiredFields.filter(k => profile[k].status === "confirmed" && !profile[k].conflicts.length);
  return { percent: Math.round(confirmed.length / requiredFields.length * 100), missing: requiredFields.filter(k => profile[k].status === "missing"), inferred: profileFields.filter(k => profile[k].status === "inferred"), conflicts: profileFields.filter(k => profile[k].conflicts.length > 0), ready: requiredFields.every(k => profile[k].status !== "missing" && !profile[k].conflicts.length) };
}
export function findConflicts(evidence: { field: typeof profileFields[number]; value: string; source: z.infer<typeof sourceSchema> }[]) {
  return profileFields.flatMap(field => { const values = evidence.filter(e => e.field === field); const unique = new Set(values.map(e => e.value.trim().replace(/\s+/g, "").toLowerCase())); return unique.size > 1 ? [{ field, evidence: values }] : []; });
}
export function profileIdentity(profile: Profile) {
  return requiredFields.map(key => `${profileLabels[key]}（${profile[key].status === "confirmed" ? "已确认" : profile[key].status === "inferred" ? "推测，请严格参考实拍" : "待核对，不得编造"}）\n${profile[key].value || "未知，遵循实拍可见外观"}`).join("\n\n");
}

export function stopsQuestions(text: string) { return /够了|开始吧|停止提问|不用再问|先开始/.test(text); }
