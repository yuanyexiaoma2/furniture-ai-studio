import "server-only";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { profileSchema, profileIdentity, type Profile } from "./profile-rules";
import { StudioError } from "./studio-error";
export async function confirmProfile(tx: Prisma.TransactionClient, productId: string, userId: string, profile: Profile) {
  const data = profileSchema.parse(profile);
  if (Object.values(data).some(f => f.conflicts.length)) throw new StudioError("还有冲突未解决，请在理解确认卡中核实并修改", 409);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
  const last = await tx.productProfile.findFirst({ where: { productId }, orderBy: { version: "desc" } });
  const identityTraits = profileIdentity(data);
  const identity = await tx.productIdentityVersion.create({ data: { productId, text: identityTraits, savedById: userId } });
  await tx.product.update({ where: { id: productId }, data: { identityTraits } });
  return tx.productProfile.create({ data: { productId, version: (last?.version ?? 0) + 1, data, confirmedById: userId, identityVersionId: identity.id } });
}
export async function getLatestProfile(productId: string) { return db.productProfile.findFirst({ where: { productId }, orderBy: { version: "desc" } }); }
