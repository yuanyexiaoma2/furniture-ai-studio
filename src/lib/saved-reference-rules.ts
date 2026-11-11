import {z} from "zod";

export const savedReferenceInput=z.object({productId:z.string().min(1),assetId:z.string().min(1),name:z.string().trim().min(1).max(120),purpose:z.string().trim().min(1).max(1000)}).strict();
export const savedReferenceSchema=z.object({
 version:z.literal(1),ownerId:z.string(),productId:z.string(),assetId:z.string(),jobId:z.string(),name:z.string(),purpose:z.string(),createdAt:z.string(),
 prompt:z.string(),references:z.array(z.object({assetId:z.string(),purpose:z.string(),role:z.string().optional(),mode:z.string().optional()})),
 plan:z.unknown().optional(),appearanceChange:z.unknown().optional(),model:z.string(),resolution:z.string(),
});
export type SavedReference=z.infer<typeof savedReferenceSchema>&{id:string};
// 只保存可追溯的生成快照，不把任意上游请求或凭据写进收藏。
export function savedGenerationSnapshot(input:Record<string,unknown>){
 const refs=[...(Array.isArray(input.referenceUsage)?input.referenceUsage:[]),...(Array.isArray(input.promptReferences)?input.promptReferences:[])];
 const references=refs.flatMap(value=>{const r=z.object({assetId:z.string(),purpose:z.string(),role:z.string().optional(),mode:z.string().optional()}).safeParse(value);return r.success?[r.data]:[];});
 return {prompt:typeof input.prompt==="string"?input.prompt:"",references,plan:input.visualPlan??null,appearanceChange:input.appearanceChange??null,resolution:typeof input.resolution==="string"?input.resolution:""};
}
