import {z} from "zod";

export const templateFields={name:z.string().trim().min(1).max(120),purpose:z.string().trim().min(1).max(1000),category:z.string().trim().max(100).optional(),scene:z.string().trim().max(120).optional(),reusablePrompt:z.string().trim().max(20000).optional()};
export const savedReferenceInput=z.object({productId:z.string().min(1),assetId:z.string().min(1),...templateFields}).strict();
export const templateUpdateSchema=z.object(templateFields).strict();
export const savedReferenceSchema=z.object({
 version:z.literal(1),ownerId:z.string(),productId:z.string(),assetId:z.string(),jobId:z.string(),name:z.string(),purpose:z.string(),createdAt:z.string(),
 prompt:z.string(),reusablePrompt:z.string().optional(),category:z.string().optional(),scene:z.string().optional(),references:z.array(z.object({assetId:z.string(),purpose:z.string(),role:z.string().optional(),mode:z.string().optional()})),
 plan:z.unknown().optional(),appearanceChange:z.unknown().optional(),model:z.string(),resolution:z.string(),
});
export type SavedReference=z.infer<typeof savedReferenceSchema>&{id:string};
export const templatePrompt=(entry:Pick<SavedReference,"prompt"|"reusablePrompt">)=>entry.reusablePrompt??entry.prompt;
export function filterTemplates(rows:SavedReference[],query:string,category="",scene="",currentCategory=""){
 const text=query.trim().toLowerCase();
 return rows.filter(row=>(!category||row.category===category)&&(!scene||row.scene===scene)&&(!text||[row.name,row.purpose,row.category,row.scene,templatePrompt(row)].join(" ").toLowerCase().includes(text)))
  .sort((a,b)=>Number(!!currentCategory&&b.category===currentCategory)-Number(!!currentCategory&&a.category===currentCategory));
}
// 只保存可追溯的生成快照，不把任意上游请求或凭据写进收藏。
export function savedGenerationSnapshot(input:Record<string,unknown>){
 const refs=[...(Array.isArray(input.referenceUsage)?input.referenceUsage:[]),...(Array.isArray(input.promptReferences)?input.promptReferences:[])];
 const references=refs.flatMap(value=>{const r=z.object({assetId:z.string(),purpose:z.string(),role:z.string().optional(),mode:z.string().optional()}).safeParse(value);return r.success?[r.data]:[];});
 return {prompt:typeof input.prompt==="string"?input.prompt:"",references,plan:input.visualPlan??null,appearanceChange:input.appearanceChange??null,resolution:typeof input.resolution==="string"?input.resolution:""};
}
