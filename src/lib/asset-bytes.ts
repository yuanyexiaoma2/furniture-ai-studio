import "server-only";
import { db } from "@/lib/db";
import { readObject, inspectPhoto } from "@/lib/storage";
export async function assetBytes(id: string) {
  const asset = await db.asset.findUniqueOrThrow({ where: { id } });
  const { bytes } = await readObject(asset.storageKey);
  const { mime } = await inspectPhoto(bytes);
  return { bytes, mime };
}
