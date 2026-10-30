import "server-only";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {agentSession,json} from "./agent-state";
import {patternSchema,visualSlotSchema} from "./visual-plan-rules";
import {StudioError} from "./studio-error";
import {chatWithGateway} from "./llm-router";
import {selectedCandidate,settingsOf} from "./studio-models";
import {z} from "zod";

export async function proposeExcellentCase(productId:string,userId:string,assetId:string){
 const final=await db.imageSlot.findFirst({where:{finalAssetId:assetId,deletedAt:null,pack:{productId,isCurrent:true}}});
 if(!final)throw new StudioError("先将图片设为终稿，再提炼优秀案例",409);
 const snapshot=final.visualPlan as {slot?:unknown}|null;
 const slot=visualSlotSchema.parse(snapshot?.slot),product=await db.product.findUniqueOrThrow({where:{id:productId}}),session=await agentSession(productId,userId);
 const analysisSchema=z.object({roomType:z.string(),light:z.string(),composition:z.string(),camera:z.string(),expression:z.string(),needs_post:z.boolean()});
 const reply=await chatWithGateway("llm-vision",{images:[{id:assetId}],responseFormat:{type:"json_object"},maxOutputTokens:1200,messages:[{role:"system",content:"拆解这张定稿中的品类级视觉经验，仅描述空间类型、光线、构图、机位和画面表达方法。不能包含任何具体产品的结构、部件数量、尺寸、颜色、型号、身份或性能承诺；不抄图中文字。输出JSON："+JSON.stringify(z.toJSONSchema(analysisSchema))},{role:"user",content:"品类："+product.category+"。请分析真实定稿，而不是旧的原始规划。"}]},{userId,productId,sessionId:session.id,candidate:await selectedCandidate("agent",settingsOf(session.settings))});
 const analysis=analysisSchema.parse(JSON.parse(reply.result.text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,"")));
 if(/\d+(?:\.\d+)?\s*(?:cm|mm|厘米|毫米|英寸|kg|公斤)/i.test(JSON.stringify(analysis)))throw new StudioError("案例拆解包含产品尺寸，不能入库；请重新提炼",502);
 // 分析与候选条目先保存在确认卡，不能由 Agent 直接写入可检索库。
 const id="curated-"+randomUUID();
 const draft={id,type:"case",name:slot.name+"视觉案例",categories:[product.category],is_sample:false,source:"人工确认",status:"ready",sellingPoints:[],content:{originalImageRef:assetId,decomposition:analysis}};
 const pattern={...draft,id:id+"-scene",type:"scene_pattern",name:analysis.roomType+"画面经验",content:analysis};
 const entries=[patternSchema.parse(draft),patternSchema.parse(pattern)];
 return db.agentCard.create({data:{sessionId:session.id,kind:"library_case",data:json({entries,note:"请核对是否只包含品类级画面经验；确认后写入模板库。"})}});
}
