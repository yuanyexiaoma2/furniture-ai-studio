import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { studioUser, studioError, StudioError } from "@/lib/studio-api";
import { uploadProductDocuments, classifyDocument, imageTypes } from "@/lib/product-documents";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await studioUser(request); return NextResponse.json(await db.productDocument.findMany({ where: { productId: (await context.params).id }, orderBy: { createdAt: "asc" } })); } catch (error) { return studioError(error, "读取资料失败"); }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await studioUser(request, true); if (Number(request.headers.get("content-length") ?? 0) > 100 * 1024 * 1024) throw new StudioError("单次上传不能超过 100MB"); const form=await request.formData(),files = form.getAll("files"); if (files.some(f => !(f instanceof File))) throw new StudioError("文件参数无效"); return NextResponse.json({ results: await uploadProductDocuments((await context.params).id, user.id, files as File[],form.get("conversation")==="true") }); } catch (error) { return studioError(error, "资料上传失败，请检查存储服务"); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await studioUser(request, true); const body = z.object({ documentId: z.string(), imageType: z.enum(imageTypes) }).parse(await request.json()); await classifyDocument((await context.params).id, body.documentId, body.imageType); return NextResponse.json({ ok: true }); } catch (error) { return studioError(error, "修改图片分类失败"); }
}
