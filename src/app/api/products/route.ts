import { NextResponse } from "next/server";
import { saveProduct } from "@/lib/product-save";
import { productSchema } from "@/lib/product-validation";
import { StudioError, studioUser, studioError } from "@/lib/studio-api";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request) {
  try {
    const user = await studioUser(request, true);
    const parsed = productSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StudioError(parsed.error.issues[0]?.message || "商品资料无效");
    const product = await saveProduct(parsed.data, user.id);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return studioError(new StudioError("该 SKU 已存在，请使用其他编号", 409), "");
    return studioError(error, "创建商品失败，请检查数据库服务后重试");
  }
}
