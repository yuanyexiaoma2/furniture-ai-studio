import {NextResponse} from "next/server";
import {z} from "zod";
import {studioUser,studioError,StudioError} from "@/lib/studio-api";
import {loadCanvasState,saveCanvasState} from "@/lib/canvas-state";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){try{const user=await studioUser(request);return NextResponse.json({...await loadCanvasState((await context.params).id,user.id),canWrite:user.role!=="viewer"});}catch(e){return studioError(e,"读取画布布局失败");}}
export async function PUT(request:Request,context:Context){try{
 const user=await studioUser(request,true);if(Number(request.headers.get("content-length")??0)>160000)throw new StudioError("画布内容过大，请精简便签");
 const body=z.object({revision:z.number().int().min(0),layout:z.unknown()}).strict().parse(await request.json());
 return NextResponse.json(await saveCanvasState((await context.params).id,user.id,body.revision,body.layout));
}catch(e){return studioError(e,"保存布局失败，本地修改仍保留，请重试");}}
