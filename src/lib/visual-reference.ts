import "server-only";
import {db} from "./db";
import {json} from "./agent-state";
import {competitorInputSchema,researchEnvelope} from "./visual-reference-rules";
import {StudioError} from "./studio-error";
export async function saveCompetitorInput(productId:string,raw:unknown){
 const inputs=competitorInputSchema.parse(raw);
 for(const link of inputs.links)if(!/^https?:$/.test(new URL(link).protocol))throw new StudioError("只支持 HTTP/HTTPS 竞品链接");
 const count=await db.asset.count({where:{id:{in:inputs.assetIds},productId,type:"style_ref",deletedAt:null}});
 if(count!==new Set(inputs.assetIds).size)throw new StudioError("竞品截图不属于本产品",400);
 // 缓存和输入一起更新，避免新截图继续复用旧分析。
 await db.product.update({where:{id:productId},data:{visualResearch:json({inputs,cache:null})}});
 await db.agentCard.updateMany({where:{session:{productId},kind:"pack",status:"pending"},data:{status:"cancelled"}});
 return inputs;
}
export async function competitorInput(productId:string){const p=await db.product.findUniqueOrThrow({where:{id:productId}});return researchEnvelope(p.visualResearch).inputs;}
