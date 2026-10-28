import "server-only";
import {mkdir,writeFile,rename,stat} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {readObject} from "./storage";
import {visualPlanSchema,type VisualPlan} from "./visual-plan-rules";
import {reviewFilename,renderVisualReview} from "./visual-review-html";
export async function writeProductReview(productId:string,override?:VisualPlan){
 const product=await db.product.findUniqueOrThrow({where:{id:productId}});
 const card=await db.agentCard.findFirst({where:{session:{productId},kind:"pack",status:{in:["pending","executed"]}},orderBy:{createdAt:"desc"}});
 const raw=card?.data as {visualPlan?:unknown;confirmedVisualPlan?:unknown;planDiff?:unknown}|undefined;
 const parsed=visualPlanSchema.safeParse(override??raw?.confirmedVisualPlan??raw?.visualPlan);
 const jobs=await db.generationJob.findMany({where:{productId,status:"success"},orderBy:{createdAt:"desc"},include:{slot:true},take:60});
 const root=(process.env.VISUAL_REVIEW_TEST_MODE==="true"?path.join(process.cwd(),".local","runtime","reviews"):path.join(process.cwd(),"docs","review")),file=reviewFilename(product.sku),folder=file.slice(0,-5)+"-assets";
 await mkdir(path.join(root,folder),{recursive:true});
 const images:{src:string;slot:string;id:string}[]=[];
 for(const job of jobs)for(const id of Array.isArray(job.resultAssetIds)?job.resultAssetIds:[]){
  if(typeof id!=="string")continue;
  const asset=await db.asset.findFirst({where:{id,productId,deletedAt:null}});if(!asset)continue;
  const object=await readObject(asset.storageKey),ext=object.mime.includes("jpeg")?"jpg":object.mime.includes("webp")?"webp":"png";
  const name=id+"."+ext;const target=path.join(root,folder,name);if((await stat(target).catch(()=>null))?.size!==object.bytes.length)await writeFile(target,object.bytes);images.push({id,slot:job.slot?.name??job.logicalModel,src:folder+"/"+name});
 }
 const html=renderVisualReview({sku:product.sku,name:product.name,plan:parsed.success?parsed.data:null,images,diff:raw?.planDiff??[],generatedAt:new Date().toISOString()});
 const temp=path.join(root,"."+randomUUID()+".html");await writeFile(temp,html,"utf8");await rename(temp,path.join(root,file));
 return path.join(root,file);
}
export async function writeProductReviewSafely(productId:string,plan?:VisualPlan){try{return await writeProductReview(productId,plan);}catch(e){console.error("[visual-review]",{productId,error:e instanceof Error?e.stack:String(e)});return null;}}
