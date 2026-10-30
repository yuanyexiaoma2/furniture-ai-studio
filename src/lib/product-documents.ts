import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { documentType, parseDocument, MAX_DOCUMENT_BYTES } from "./document-parser";
import { inspectPhoto, putObject, deleteObject } from "./storage";
import { StudioError } from "./studio-error";
export const imageTypes = ["photo", "white_bg", "render_3d", "detail", "other"] as const;
export async function uploadProductDocuments(productId: string, userId: string, files: File[],conversation=false) {
  if (!await db.product.findUnique({ where: { id: productId } })) throw new StudioError("商品不存在", 404);
  if (files.reduce((n, file) => n + file.size, 0) > 100 * 1024 * 1024) throw new StudioError("单次上传不能超过 100MB");
  if (!files.length || files.length > 15) throw new StudioError("每次可上传 1～15 个文件");
  const results: { filename: string; id?: string; assetId?:string; error?: string }[] = [];
  for (const file of files) {
    let key: string | undefined; let documentId: string | undefined;
    try {
      if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw new Error("文件不能为空，单文件不能超过 30MB");
      const type = documentType(file.name), bytes = Buffer.from(await file.arrayBuffer());
      const photo = type === "image" ? await inspectPhoto(bytes) : null;
      const mime = photo?.mime ?? ({ pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv" }[type] ?? file.type);
      key = `products/${productId}/documents/${randomUUID()}.${file.name.split(".").pop()?.toLowerCase()}`;
      await putObject(key, bytes, mime);
      const storageKey = key;
      const document = await db.$transaction(async tx => {
        const asset = photo ? await tx.asset.create({ data: { productId, createdById: userId, storageKey, type: "style_ref", width: photo.width, height: photo.height } }) : null;
        return tx.productDocument.create({ data: { productId, createdById: userId, filename: file.name.slice(0, 200), type, mime, storageKey, assetId: asset?.id, parseStatus: photo ? "ready" : "pending", imageType: photo ? "unclassified" : null } });
      });
      documentId = document.id; key = undefined;
      if (!photo) await db.productDocument.update({ where: { id: document.id }, data: { text: await parseDocument(bytes, type), parseStatus: "ready" } });
      results.push({ filename: file.name, id: document.id,...(document.assetId?{assetId:document.assetId}:{}) });
    } catch (error) {
      const message = error instanceof Error && /[\u3400-\u9fff]/.test(error.message) ? error.message : "解析失败，请检查文件是否损坏、加密或格式不符";
      if (documentId) await db.productDocument.update({ where: { id: documentId }, data: { parseStatus: "failed", error: message } });
      if (key) await deleteObject(key).catch(() => undefined);
      results.push({ filename: file.name, ...(documentId ? { id: documentId } : {}), error: message });
    }
  }
  // 对话附件可能只是风格参考，不因上传就覆盖产品身份或取消已确认方案。
  if(conversation&&results.some(r=>r.assetId)){
    const session=await db.agentSession.findUniqueOrThrow({where:{productId_createdById:{productId,createdById:userId}}});
    await db.chatMessage.create({data:{productId,sessionId:session.id,role:"user",content:{text:"添加了对话图片，具体用途以接下来的要求为准。",referenceAssetIds:results.flatMap(r=>r.assetId?[r.assetId]:[])}}});
  }
  if(!conversation||files.some(f=>documentType(f.name)!=="image")){
  await db.agentSession.updateMany({ where: { productId }, data: { confirmedProfileId: null, confirmedPack: false, draftRevision: { increment: 1 } } });
  const sessions = await db.agentSession.findMany({ where: { productId }, select: { id: true } });
  await db.agentCard.updateMany({ where: { sessionId: { in: sessions.map(s => s.id) }, kind: { in: ["profile", "pack", "cost"] }, status: "pending" }, data: { status: "cancelled" } });
  }
  return results;
}
export async function classifyDocument(productId: string, documentId: string, imageType: typeof imageTypes[number]) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
    const doc = await tx.productDocument.findFirst({ where: { id: documentId, productId, type: "image" } });
    if (!doc?.assetId) throw new StudioError("当前 SKU 的图片资料不存在", 404);
    await tx.asset.update({ where: { id: doc.assetId }, data: { type: imageType === "photo" || imageType === "white_bg" ? imageType : "style_ref" } });
    await tx.productDocument.update({ where: { id: documentId }, data: { imageType } });
  });
}
