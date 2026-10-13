import "server-only";
import { db } from "./db";
import { StudioError } from "./studio-error";
import type { ProductFormData } from "./product-validation";
export async function saveProduct(data: ProductFormData, userId: string, id?: string) {
  return db.$transaction(async tx => {
    if (id) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      if (!await tx.product.findUnique({ where: { id }, select: { id: true } })) throw new StudioError("商品不存在", 404);
    }
    const product = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data: { ...data, createdById: userId } });
    await tx.productIdentityVersion.create({ data: { productId: product.id, text: data.identityTraits, savedById: userId } });
    return { id: product.id };
  });
}
