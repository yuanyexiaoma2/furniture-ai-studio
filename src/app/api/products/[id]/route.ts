import { NextResponse } from "next/server";
import { saveProduct } from "@/lib/product-save";
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
    const user = await studioUser(request, true);
    const { id } = await context.params;
    const parsed = productSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StudioError(parsed.error.issues[0]?.message || "商品资料无效");
    await saveProduct(parsed.data, user.id, id);
    return NextResponse.json({ product: await productSnapshot(id) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return studioError(new StudioError("该 SKU 已存在", 409), "");
    return studioError(error, "保存商品失败，请稍后重试");
  }
}
