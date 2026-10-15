import {NextResponse} from "next/server";
import {z} from "zod";
import {studioUser,studioError,StudioError} from "@/lib/studio-api";
import {studioCatalog,passedProbe} from "@/lib/studio-models";
import {db} from "@/lib/db";
export async function GET(request:Request){try{const user=await studioUser(request),admin=new URL(request.url).searchParams.get("admin")==="1";if(admin&&user.role!=="admin")throw new StudioError("仅管理员可以查看全部模型",403);return NextResponse.json({models:await studioCatalog(admin)});}catch(e){return studioError(e,"读取模型失败，请重新登录或联系管理员");}}
export async function PATCH(request:Request){try{const user=await studioUser(request,true);if(user.role!=="admin")throw new StudioError("仅管理员可以配置模型",403);const data=z.object({id:z.string(),visible:z.boolean()}).strict().parse(await request.json()),model=await db.studioModel.findUniqueOrThrow({where:{id:data.id}});if(data.visible&&model.kind==="agent"&&!passedProbe(model.probe))throw new StudioError("该模型尚未达到95%工具调用正确率或未完成20轮稳定性验证，不能向美工开放",409);await db.studioModel.update({where:{id:model.id},data:{visible:data.visible}});return NextResponse.json({models:await studioCatalog(true)});}catch(e){return studioError(e,"保存模型配置失败，请刷新核对");}}
