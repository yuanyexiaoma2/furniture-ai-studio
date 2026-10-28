import "server-only";
import {createHash} from "node:crypto";
import {StudioError} from "./studio-error";
import {db} from "./db";
import {visualPlanSchema,patternSchema,type VisualPlan} from "./visual-plan-rules";
import {reviewFilename} from "./review-file-name";
export async function readReviewSource(productId:string,override?:VisualPlan){
 const product=await db.product.findUnique({where:{id:productId}});if(!product)throw new StudioError("产品不存在",404);
 const card=await db.agentCard.findFirst({where:{session:{productId},kind:"pack",status:{in:["pending","executed"]}},orderBy:{createdAt:"desc"}});
 const raw=card?.data as {visualPlan?:unknown;confirmedVisualPlan?:unknown;planDiff?:unknown}|undefined;
 const parsed=visualPlanSchema.safeParse(override??raw?.confirmedVisualPlan??raw?.visualPlan);
 const jobs=await db.generationJob.findMany({where:{productId,status:"success"},orderBy:{createdAt:"desc"},include:{slot:true},take:60});
 const ids=jobs.flatMap(j=>Array.isArray(j.resultAssetIds)?j.resultAssetIds.filter((id):id is string=>typeof id==="string"):[]);
 const assets=await db.asset.findMany({where:{id:{in:ids},productId,deletedAt:null}});
 const file=reviewFilename(product.sku),folder=file.slice(0,-5)+"-assets";
 const images=jobs.flatMap(j=>(Array.isArray(j.resultAssetIds)?j.resultAssetIds:[]).flatMap(id=>{const asset=assets.find(a=>a.id===id);if(!asset)return [];const ext=/\.(jpe?g|webp|png)$/i.exec(asset.storageKey)?.[1]??"png";return [{id:asset.id,slot:j.slot?.name??j.logicalModel,src:folder+"/"+asset.id+"."+ext}];}));
 const library=await db.studioLibraryEntry.findMany({select:{data:true}});
 const libraryEntryCount=library.length,libraryEligibleCount=library.filter(row=>{const p=patternSchema.safeParse(row.data);return p.success&&!p.data.is_sample&&p.data.status==="ready";}).length;
 const plan=parsed.success?parsed.data:null;
 const planVersion=createHash("sha256").update(JSON.stringify({plan,images:images.map(i=>i.id),libraryEntryCount,libraryEligibleCount})).digest("hex").slice(0,16);
 return {productId,sku:product.sku,name:product.name,plan,images,diff:raw?.planDiff??[],generatedAt:new Date().toISOString(),planVersion,libraryEntryCount,libraryEligibleCount,assets,file,folder};
}
