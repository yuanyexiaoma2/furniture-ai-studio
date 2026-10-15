import {NextResponse} from "next/server";
import {studioUser,studioError,StudioError} from "@/lib/studio-api";
import {db} from "@/lib/db";
import {createStudioTask} from "@/lib/studio-main";
export const runtime="nodejs";
export async function GET(request:Request){try{await studioUser(request);return NextResponse.json(await db.product.findMany({orderBy:{updatedAt:"desc"},select:{id:true,sku:true,name:true,category:true,updatedAt:true,assets:{where:{type:"photo",deletedAt:null},take:1,select:{id:true}},imagePacks:{where:{isCurrent:true},select:{slots:{where:{deletedAt:null},select:{id:true,finalAssetId:true}}}}}}));}catch(e){return studioError(e,"读取 SKU 失败，请刷新重试");}}
export async function POST(request:Request){try{const user=await studioUser(request,true);if(Number(request.headers.get("content-length")??0)>101*1024*1024)throw new StudioError("资料合计超过100MB，请精简后重试");return NextResponse.json(await createStudioTask(user.id,await request.formData()),{status:201});}catch(e){return studioError(e,"创建任务失败，资料未完成上传，请检查数据库和存储服务后重试");}}
