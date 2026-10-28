import {NextResponse} from "next/server";
import {z} from "zod";
import {studioUser,studioError,StudioError} from "@/lib/studio-api";
import {importListingFolder,approveListingImport} from "@/lib/listing-import";
export const runtime="nodejs";export const maxDuration=300;
export async function POST(r:Request){try{const user=await studioUser(r,true);if(Number(r.headers.get("content-length")??0)>101*1024*1024)throw new StudioError("上传不能超过100MB");const form=await r.formData(),files=form.getAll("files");if(files.some(f=>!(f instanceof File)))throw new StudioError("文件参数无效");return NextResponse.json(await importListingFolder(user.id,String(form.get("category")??""),files as File[]));}catch(e){return studioError(e,"拆解未完成；请检查文件或模型配置后重试");}}
export async function PUT(r:Request){try{const user=await studioUser(r,true),body=z.object({id:z.string(),entries:z.unknown()}).parse(await r.json());return NextResponse.json(await approveListingImport(user.id,body.id,body.entries));}catch(e){return studioError(e,"审核失败");}}
