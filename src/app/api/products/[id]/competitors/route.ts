import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {db} from "@/lib/db";
import {studioUser,studioError,StudioError} from "@/lib/studio-api";
import {competitorInput,saveCompetitorInput} from "@/lib/visual-reference";
import {inspectPhoto,putObject,deleteObject} from "@/lib/storage";
type Ctx={params:Promise<{id:string}>};
export async function GET(r:Request,c:Ctx){try{await studioUser(r);return NextResponse.json(await competitorInput((await c.params).id));}catch(e){return studioError(e,"读取竞品失败");}}
export async function PUT(r:Request,c:Ctx){try{await studioUser(r,true);return NextResponse.json(await saveCompetitorInput((await c.params).id,await r.json()));}catch(e){return studioError(e,"保存竞品失败");}}
export async function POST(r:Request,c:Ctx){
 const keys:string[]=[];
 try{const user=await studioUser(r,true),productId=(await c.params).id;
 if(Number(r.headers.get("content-length")??0)>100*1024*1024)throw new StudioError("单次上传不能超过100MB");
 const files=(await r.formData()).getAll("images"),input=await competitorInput(productId);
 if(!files.length||input.assetIds.length+files.length>10)throw new StudioError("每个产品最多10张竞品截图");
 const photos:{width:number;height:number;key:string}[]=[];for(const file of files){if(!(file instanceof File))throw new StudioError("图片参数无效");const bytes=Buffer.from(await file.arrayBuffer()),photo=await inspectPhoto(bytes),key="products/"+productId+"/competitors/"+randomUUID()+"."+photo.extension;await putObject(key,bytes,photo.mime);keys.push(key);photos.push({...photo,key});}
 const assetIds=await db.$transaction(async tx=>{const ids=[];for(const p of photos)ids.push((await tx.asset.create({data:{productId,createdById:user.id,type:"style_ref",storageKey:p.key,width:p.width,height:p.height}})).id);return ids;});
 keys.length=0;return NextResponse.json({assetIds});
 }catch(e){return studioError(e,"上传竞品失败");}finally{for(const key of keys)await deleteObject(key).catch(()=>undefined);}
}
