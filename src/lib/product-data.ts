import "server-only";
import { db } from "@/lib/db";
import { expireOverdueJobs } from "@/lib/generation-queue";

function readable(value: unknown) {
  return typeof value === "string" ? value : Array.isArray(value) ? value.join("、") : value ? JSON.stringify(value) : "";
}
export async function productSnapshot(id: string) {
  await expireOverdueJobs();
  const product = await db.product.findUnique({ where: { id }, include: {
    identityVersions: { orderBy: { savedAt: "desc" }, take: 1, include: { savedBy: { select: { name: true } } } },
    assets: { where: { type: "photo", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, width: true, height: true } },
    generationJobs: { take: 50, orderBy: { createdAt: "desc" }, select: { id: true, logicalModel: true, provider: true, model: true, input: true, externalTaskId: true, status: true, costUsd: true, credits: true, costEstimated: true, fallback: true, reservedUsd: true, resultAssetIds: true, error: true, createdAt: true, startedAt: true, completedAt: true } },
  } });
  if (!product) return null;
  const resultImages = await db.asset.findMany({ where: { deletedAt: null, id: { in: product.generationJobs.flatMap(j => Array.isArray(j.resultAssetIds) ? j.resultAssetIds.filter((s): s is string => typeof s === "string") : []) } }, select: { id: true, width: true, height: true } });
  const version = product.identityVersions[0];
  return {
    id: product.id, sku: product.sku, name: product.name, category: product.category,
    dimensions: readable(product.dimensions), colors: readable(product.colors), sellingPoints: readable(product.sellingPoints),
    materials: product.materials, complexity: product.complexity, identityTraits: product.identityTraits || "", photos: product.assets,
    identityVersion: version ? { id: version.id, savedBy: version.savedBy?.name ?? null, savedAt: version.savedAt.toISOString(), historical: version.historical } : null,
    jobs: product.generationJobs.map((job) => ({
      id: job.id, logicalModel: job.logicalModel, provider: job.provider, model: job.model, taskId: job.externalTaskId,
      resolution: (job.input as Record<string, unknown>)?.resolution as string ?? "",
      aspectRatio: (job.input as Record<string, unknown>)?.aspect_ratio as string ?? "",
      sceneIntent: (job.input as Record<string, unknown>)?.sceneIntent as string ?? "",
      editIntent: (job.input as Record<string, unknown>)?.editIntent as string ?? "",
      sourceJobId: (job.input as Record<string, unknown>)?.sourceJobId as string ?? null,
      sourceAssetId: (job.input as Record<string, unknown>)?.sourceAssetId as string ?? null,
      status: job.status, costUsd: job.costUsd === null ? null : Number(job.costUsd), credits: job.credits === null ? null : Number(job.credits), costEstimated: job.costEstimated, fallback: job.fallback, reservedUsd: Number(job.reservedUsd), error: job.error,
      identityTraits: String((job.input as Record<string, unknown>).identityTraits ?? ""), identityVersionId: (job.input as Record<string, unknown>).identityVersionId as string | null ?? null, identitySavedById: (job.input as Record<string, unknown>).identitySavedById as string | null ?? null, identitySavedAt: (job.input as Record<string, unknown>).identitySavedAt as string | null ?? null,
      resultImages: resultImages.filter(a => Array.isArray(job.resultAssetIds) && job.resultAssetIds.includes(a.id)),
      resultAssetIds: Array.isArray(job.resultAssetIds) ? job.resultAssetIds.filter((value): value is string => typeof value === "string" && resultImages.some(a => a.id === value)) : [],
      createdAt: job.createdAt.toISOString(), startedAt: job.startedAt?.toISOString() ?? null, completedAt: job.completedAt?.toISOString() ?? null,
    })),
  };
}
export type ProductSnapshot = NonNullable<Awaited<ReturnType<typeof productSnapshot>>>;
