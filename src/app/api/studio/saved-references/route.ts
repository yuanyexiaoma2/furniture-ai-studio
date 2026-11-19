import {NextResponse} from "next/server";
import {z} from "zod";
import {studioUser,studioError} from "@/lib/studio-api";
import {listSavedReferences,saveReference,reuseReference,updateSavedTemplate,templateDraft} from "@/lib/saved-references";
export async function GET(request:Request){try{const user=await studioUser(request),params=new URL(request.url).searchParams;if(params.has("assetId")){const input=z.object({productId:z.string().min(1),assetId:z.string().min(1)}).parse(Object.fromEntries(params));return NextResponse.json(await templateDraft(input.productId,input.assetId));}return NextResponse.json(await listSavedReferences(user.id));}catch(error){return studioError(error,"读取收藏失败，请重试");}}
export async function POST(request:Request){try{
 const user=await studioUser(request,true),body=z.discriminatedUnion("action",[
  z.object({action:z.literal("save"),data:z.unknown()}).strict(),
  z.object({action:z.literal("reuse"),withPrompt:z.boolean().optional(),id:z.string().min(1),productId:z.string().min(1)}).strict(),
  z.object({action:z.literal("prepare"),id:z.string().min(1),productId:z.string().min(1)}).strict(),
  z.object({action:z.literal("update"),id:z.string().min(1),data:z.unknown()}).strict(),
 ]).parse(await request.json());
 return NextResponse.json(body.action==="save"?await saveReference(user.id,body.data):body.action==="update"?await updateSavedTemplate(user.id,body.id,body.data):await reuseReference(user.id,body.id,body.productId,undefined,{attach:body.action!=="prepare",withPrompt:body.action==="reuse"&&body.withPrompt===true}));
}catch(error){return studioError(error,"收藏操作未完成，请重试");}}
