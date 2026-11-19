import {z} from "zod";
import {expansionSchema} from "@/lib/expansion-rules";

const draftSchema=z.object({
 productId:z.string().optional(),images:z.array(z.object({id:z.string(),name:z.string()})).max(2),
 prompt:z.string(),environment:z.enum(["keep","adapt"]),modelId:z.string(),resolution:z.string(),ratio:z.string(),
 extent:expansionSchema.optional(),
});
export type ToolDraft=z.infer<typeof draftSchema>;
const key=(scope:string)=>"furniture-tool-draft:"+scope;
export function readToolDraft(scope:string):ToolDraft|undefined{
 try{const raw=sessionStorage.getItem(key(scope));if(raw)return draftSchema.parse(JSON.parse(raw));}catch{/* 损坏或不可用的本地草稿不阻止创作。 */}
}
export function writeToolDraft(scope:string,draft:ToolDraft){
 try{sessionStorage.setItem(key(scope),JSON.stringify(draft));}catch{/* 私密模式下继续保留当前页面状态。 */}
}
export function clearToolDraft(scope:string){
 try{sessionStorage.removeItem(key(scope));}catch{/* 不影响已经提交的任务。 */}
}
