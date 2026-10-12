import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productSnapshot } from "@/lib/product-data";
import { productSchema } from "@/lib/product-validation";
import { StudioError, studioUser, studioError } from "@/lib/studio-api";
import { Prisma } from "@/generated/prisma/client";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    await studioUser(request);
    const product = await productSnapshot((await context.params).id);
    if (!product) throw new StudioError("商品不存在", 404);
    return NextResponse.json({ product });
  } catch (error) { return studioError(error, "读取商品失败，请稍后重试"); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    await studioUser(request, true);
    const { id } = await context.params;
    const parsed = productSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StudioError(parsed.error.issues[0]?.message || "商品资料无效");
    if (!await db.product.findUnique({ where: { id }, select: { id: true } })) throw new StudioError("商品不存在", 404);
    await db.product.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ product: await productSnapshot(id) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return studioError(new StudioError("该 SKU 已存在", 409), "");
    return studioError(error, "保存商品失败，请稍后重试");
  }
}
