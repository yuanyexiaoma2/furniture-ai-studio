import {NextResponse} from "next/server";
import {z} from "zod";
import {studioUser,studioError} from "@/lib/studio-api";
import {listSavedReferences,saveReference,reuseReference} from "@/lib/saved-references";
export async function GET(request:Request){try{const user=await studioUser(request);return NextResponse.json(await listSavedReferences(user.id));}catch(error){return studioError(error,"读取收藏失败，请重试");}}
export async function POST(request:Request){try{
 const user=await studioUser(request,true),body=z.discriminatedUnion("action",[
  z.object({action:z.literal("save"),data:z.unknown()}).strict(),
  z.object({action:z.literal("reuse"),id:z.string().min(1),productId:z.string().min(1)}).strict(),
 ]).parse(await request.json());
 return NextResponse.json(body.action==="save"?await saveReference(user.id,body.data):await reuseReference(user.id,body.id,body.productId));
}catch(error){return studioError(error,"收藏操作未完成，请重试");}}
