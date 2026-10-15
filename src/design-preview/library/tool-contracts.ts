/** 8B 工具边界草案：只解析参数和声明规则，不执行请求。 */
import {z} from "zod";
import type {Actor,EntryBase} from "./types";
import {canView} from "./rules";
const code=z.string().regex(/^[A-Z][A-Z0-9-]{1,23}$/,"使用服务端下发的短码");
const edit=z.object({img:code,orig:z.array(code).min(1),ask:z.string().min(1),consent:z.literal(true)}).strict();
export const toolSchemas={
 ingest_files:z.object({sku:code,files:z.array(code).min(1)}).strict(),
 classify_shot_angles:z.object({sku:code,photos:z.array(code).min(1)}).strict(),
 check_shooting_coverage:z.object({sku:code,mode:z.enum(["quick","strict"])}).strict(),
 web_search_product:z.object({sku:code,q:z.string().min(1)}).strict(),
 update_product_card:z.object({sku:code,features:z.array(z.object({k:z.string(),v:z.string(),lock:z.boolean()})),confirm:z.boolean()}).strict(),
 search_scene_templates:z.object({cat:code,tags:z.array(z.string())}).strict(),
 search_props:z.object({cat:code,group:code.optional(),tags:z.array(z.string())}).strict(),
 search_references:z.object({cat:code,tags:z.array(z.string())}).strict(),
 compose_prompt:z.object({sku:code,scene:code,groups:z.array(code),props:z.array(code),refs:z.array(code),vars:z.record(z.string(),z.string())}).strict(),
 generate_image:z.object({recipe:code,model:code,count:z.number().int().min(1).max(4),quote:code,confirmed:z.boolean()}).strict(),
 inpaint:edit.extend({mask:code}),erase:edit.extend({mask:code}),cutout:edit,outpaint:edit.extend({box:z.object({w:z.number().positive(),h:z.number().positive(),x:z.number(),y:z.number()})}),recolor:edit.extend({color:z.string().min(1)}),replace_background:edit,upscale:edit.extend({scale:z.number().min(1).max(4)}),
 reverse_prompt:z.object({img:code,recipe:code}).strict(),
 save_to_library:z.object({kind:z.enum(["scene","prop","reference","snippet"]),source:code,name:z.string().min(1),visibility:z.literal("private")}).strict(),
 export_pack:z.object({sku:code,finals:z.array(code).min(1)}).strict(),
};
export type AgentToolName=keyof typeof toolSchemas;
export const agentRules={humanLanguageOnly:true,oneQuestionAtATime:true,questionOptions:{min:2,max:4},editsRequireExplicitUserRequest:true,editsRequireAllOriginalPhotos:true,showEstimateBeforePaidTool:true,confirmAboveSingleThreshold:true,doNotRepeatQuickShootingPrompts:true,automaticQualityRepairLoop:false} as const;
export function resolveShortCodes(ids:string[],registry:EntryBase[],actor:Actor){return ids.map(id=>{code.parse(id);const row=registry.find(r=>r.id===id);if(!row||!canView(row,actor))throw new Error("短码无效或无权使用");return row;});}
