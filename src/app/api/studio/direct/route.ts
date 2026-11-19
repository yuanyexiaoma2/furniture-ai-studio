import {NextResponse} from "next/server";
import {z} from "zod";
import {studioUser,studioError} from "@/lib/studio-api";
import {directImageSchema} from "@/lib/direct-image-rules";
import {quoteDirectImage,submitDirectImage,uploadDirectImages} from "@/lib/direct-image-generation";

export const runtime="nodejs";
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("quote"),selection:directImageSchema}).strict(),
 z.object({action:z.literal("submit"),selection:directImageSchema,fingerprint:z.string().min(1),requestKey:z.string().uuid()}).strict(),
]);
export async function POST(request:Request){
 try{
  const user=await studioUser(request,true);
  if(request.headers.get("content-type")?.startsWith("multipart/form-data")){
   const form=await request.formData(),files=form.getAll("files");
   if(files.some(f=>!(f instanceof File)))return NextResponse.json({error:"请上传有效图片"},{status:400});
   return NextResponse.json(await uploadDirectImages(user.id,z.string().min(1).optional().parse(form.get("productId")??undefined),files as File[],z.string().uuid().optional().parse(form.get("requestKey")??undefined)));
  }
  const body=schema.parse(await request.json());
  return NextResponse.json(body.action==="quote"?await quoteDirectImage(body.selection):await submitDirectImage(user.id,body.selection,body.fingerprint,body.requestKey));
 }catch(error){return studioError(error,"单张生图未完成，请核对进度后重试");}
}
