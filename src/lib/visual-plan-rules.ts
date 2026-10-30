import {z} from "zod";

export const patternTypes=["scene_pattern","selling_point_pattern","prop_pool","slot_sequence","case"] as const;
export const patternSchema=z.object({
 id:z.string(),type:z.enum(patternTypes),name:z.string(),categories:z.array(z.string()),
 is_sample:z.boolean(),source:z.enum(["用户提供","Codex 生成的示例","人工确认"]),
 sellingPoints:z.array(z.string()).default([]),content:z.record(z.string(),z.unknown()),
 status:z.enum(["ready","pending_images","draft"]).default("ready"),
});
export type VisualPattern=z.infer<typeof patternSchema>;
export const identityLockSchema=z.object({traits:z.string().min(1),structure:z.string(),materials:z.string(),colors:z.string(),functions:z.array(z.string()),sellingPoints:z.array(z.object({name:z.string(),evidence:z.string(),priority:z.number().int()})).min(1),referenceAssetIds:z.array(z.string()).min(1),identityVersionId:z.string().nullable()});
const slotBaseSchema=z.object({key:z.string().min(1),name:z.string().min(1),slotType:z.enum(["main","scene","dimension","selling_point","detail","installation"]),method:z.enum(["ai_scene","manual_upload"]).optional(),aspectRatio:z.enum(["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9","1:4","4:1","1:8","8:1","auto"]).optional(),sellingPoint:z.string(),scene:z.string(),props:z.array(z.string()),display:z.string(),camera:z.string(),light:z.string(),palette:z.string(),composition:z.string(),needs_post:z.boolean(),postNotes:z.string(),evidence:z.array(z.string()).min(1),notes:z.string().default(""),combinationKey:z.string().default("")});
export const directionSchema=slotBaseSchema.omit({key:true,name:true,slotType:true,method:true,aspectRatio:true,notes:true,combinationKey:true}).extend({id:z.string().min(1),label:z.string().min(1),reason:z.string().min(1)});
export const visualSlotSchema=slotBaseSchema.extend({directions:z.array(directionSchema).max(3).optional(),selectedDirectionId:z.string().nullable().optional()});
export const referenceBreakdownSchema=z.object({ref:z.string(),space:z.string(),props:z.array(z.string()),display:z.string(),sellingExpression:z.string(),camera:z.string()});
export const researchSchema=z.object({status:z.enum(["success","skipped"]),note:z.string(),commonScenes:z.array(z.string()),commonExpressions:z.array(z.string()),homogeneity:z.array(z.string()),opportunities:z.array(z.string()),sources:z.array(z.object({title:z.string(),url:z.string().url(),content:z.string()})),cachedAt:z.string(),references:z.array(referenceBreakdownSchema).default([]),supplement:z.object({status:z.enum(["success","skipped"]),note:z.string(),text:z.string(),sources:z.array(z.object({title:z.string(),url:z.string(),content:z.string()}))}).optional()});
export const visualPlanSchema=z.object({version:z.literal(1),productId:z.string(),identityLock:identityLockSchema,research:researchSchema,libraryIds:z.array(z.string()),libraryNote:z.string(),reason:z.string(),slots:z.array(visualSlotSchema).min(1).max(30),createdAt:z.string(),propPool:z.array(z.string()).optional(),scenePool:z.array(z.string()).optional(),comparisonScope:z.array(z.string()).optional(),excludedCombinationKeys:z.array(z.string()).optional()});
export type VisualPlan=z.infer<typeof visualPlanSchema>;
export type VisualSlot=z.infer<typeof visualSlotSchema>;
export function requiresDirections(s:VisualSlot,index:number){const n=Number(/(?:^|[^0-9])([1-9])(?:[^0-9]|$)/.exec(s.key)?.[1]??index+1);return n>=4&&n<=8;}
export function selectVisualDirection(slot:VisualSlot,id:string):VisualSlot{const d=slot.directions?.find(d=>d.id===id);if(!d)throw new Error("请选择已有方向");const {id:_,label:__,reason:___,...visual}=d;void _;void __;void ___;return {...slot,...visual,selectedDirectionId:id};}
export function visualPlanDiff(original:VisualPlan,confirmed:VisualPlan){
 const changed=confirmed.slots.flatMap(s=>{const prior=original.slots.find(p=>p.key===s.key);return Object.entries(s).filter(([k,v])=>k!=="combinationKey"&&JSON.stringify(prior?.[k as keyof VisualSlot])!==JSON.stringify(v)).map(([field,after])=>({slotKey:s.key,field,before:prior?.[field as keyof VisualSlot]??null,after}));});
 const removed=original.slots.filter(s=>!confirmed.slots.some(c=>c.key===s.key)).map(s=>({slotKey:s.key,field:"slot",before:s,after:null}));
 return [...changed,...removed];
}
export type IdentityLock=z.infer<typeof identityLockSchema>;
export function composeIdentityLock(identity:IdentityLock){return [identity.traits,"结构与部件："+identity.structure,"材质："+identity.materials,"颜色："+identity.colors,"资料支持的功能："+identity.functions.join("；")].join("\n");}
const normalized=(s:string)=>s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,"");
export function visualCombinationKey(slot:VisualSlot){return [slot.scene,[...slot.props].sort().join("|"),slot.display,slot.camera].map(normalized).join("::");}
export function validateVisualPlan(raw:unknown,previousKeys:string[]=[]){
 const plan=visualPlanSchema.parse(raw),keys=new Set([...previousKeys,...plan.excludedCombinationKeys??[]]),scenes=new Set<string>(),props=new Set<string>(),slotKeys=new Set<string>();
 for(const s of plan.slots){
  if(slotKeys.has(s.key))throw new Error("图位标识重复");slotKeys.add(s.key);
  s.combinationKey=visualCombinationKey(s);
  if(keys.has(s.combinationKey))throw new Error("画面组合重复，请替换场景或陈列");keys.add(s.combinationKey);
  if(s.slotType==="scene"){
   const scene=normalized(s.scene);if(scenes.has(scene))throw new Error("场景图之间不能使用相同场景");scenes.add(scene);
   for(const p of s.props){const key=normalized(p);if(props.has(key))throw new Error("场景图道具重复："+p);props.add(key);}
  }
  if(plan.propPool&&s.props.some(p=>!plan.propPool!.includes(p)))throw new Error("请从道具池选择道具");
  if(s.directions)for(const d of s.directions){if(plan.propPool&&d.props.some(p=>!plan.propPool!.includes(p)))throw new Error("方向包含池外道具");}
  if(!s.evidence.every(id=>plan.libraryIds.includes(id)||id==="identityLock"||plan.research.references.some(r=>r.ref===id)||plan.research.sources.some(r=>r.url===id)))throw new Error("方案引用了未检索的依据");
 }
 return plan;
}
export function retrievePatterns(rows:unknown[],category:string,sellingPoints:string[]){
 if(!category.trim()||category==="待确认")return {entries:[] as VisualPattern[],note:"产品品类尚未确认，暂不检索品类经验"};
 const eligible=rows.flatMap(r=>{const p=patternSchema.safeParse(r);return p.success&&!p.data.is_sample&&p.data.status==="ready"?[p.data]:[];});
 const matches=(p:VisualPattern)=>p.categories.some(c=>c===category||c.includes(category)||category.includes(c));
 const exact=eligible.filter(matches);
 // 相近品类是显式映射，不能把任意不相关示例当作经验。
 const families=[["鞋架","shoe_rack_vertical","置物架","收纳架","书架"],["浴室柜","马桶架","浴室收纳"],["边桌","茶几","床头柜"]];
 const family=families.find(f=>f.some(c=>category.includes(c)));
 const related=family?eligible.filter(p=>p.categories.some(c=>family.some(f=>c.includes(f)))):[];
 const pool=exact.length?exact:related;
 return {entries:pool.map((p,i)=>({p,i,score:p.sellingPoints.reduce((n,s)=>n+(sellingPoints.some(t=>t.includes(s)||s.includes(t))?2:0),0)})).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,40).map(x=>x.p),note:exact.length?"使用同品类经验":related.length?"没有同品类经验，使用相近品类经验；具体功能以本产品实拍为准":"没有可用的同品类或相近品类经验，本方案仅依据本产品和可用竞品资料"};
}
export function composeVisualSlot(slot:VisualSlot){
 return [`画面目标：${slot.sellingPoint}`,`空间：${slot.scene}`,`环境配饰：${slot.props.join("、")||"无"}`,`陈列：${slot.display}`,`机位：${slot.camera}`,`光线：${slot.light}`,`环境色调：${slot.palette}`,`构图：${slot.composition}`,slot.slotType==="main"?"亚马逊主图：纯白背景RGB(255,255,255)，产品完整入画且长边占画面至少85%，输出长边不少于2000像素。":"",slot.slotType==="detail"?"允许局部取景；所有可见结构必须真实，未验证的拆卸状态不得展示。":"产品结构、部件数量和尺寸比例保持不变，产品完整入画。",slot.needs_post?"只生成干净摄影底图，为后期设计留白。":"",slot.notes].filter(Boolean).join("\n");
}

// 限制集中在最终包装层，内部引用只留在元数据里。
export const IMAGE_CONTENT_RULE="画面中不得出现任何文字、字母、数字、图标、标注线、尺寸线、水印、logo。";
const IMAGE_SURFACE_RULE="配饰采用无字无品牌的素面设计：标签、书脊、时钟显示屏和装饰画署名处保持空白。";
export function sanitizePrompt(text:string,identifiers:string[]=[]){
 let clean=text;
 for(const id of [...identifiers].filter(Boolean).sort((a,b)=>b.length-a.length))clean=clean.split(id).join("");
 clean=clean.replace(/\b[a-z][a-z0-9]{23,31}\b/gi,"").replace(/\b(?:SKU|productId|assetId|templateId|slotId|combinationKey)\s*[:：=]?\s*[A-Za-z0-9_-]+/gi,"");
 // 明确物理尺寸转换为相对表达，不把 cm 数字带给生图模型。
 clean=clean.replace(/\d+(?:\.\d+)?\s*(?:[x×*]\s*\d+(?:\.\d+)?\s*){1,3}(?:cm|mm|厘米|毫米|m|米|inch(?:es)?|英寸)/gi,"与实拍一致的长宽高比例");
 clean=clean.replace(/\d+(?:\.\d+)?\s*(?:cm|mm|厘米|毫米|米|inch(?:es)?|英寸)/gi,"与实拍一致的比例");
 clean=clean.replace(/(?:\d+(?:\.\d+)?\s*(?:-|–|~|至)\s*)?\d+(?:\.\d+)?\s*(?:kg|千克|公斤|lb|磅)/gi,"经资料确认的承载范围");
 // 方案里的后期需求不可混入摄影提示词。
 clean=clean.split(/\r?\n/).filter(line=>![IMAGE_CONTENT_RULE,IMAGE_SURFACE_RULE].includes(line.trim())).join("\n");
 return clean.replace(/\n{3,}/g,"\n\n").trim();
}
export function wrapImagePrompt(text:string,identifiers:string[]=[]){return sanitizePrompt(text,identifiers)+"\n"+IMAGE_SURFACE_RULE+"\n"+IMAGE_CONTENT_RULE;}
