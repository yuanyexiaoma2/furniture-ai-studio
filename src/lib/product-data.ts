import "server-only";
import { db } from "@/lib/db";
import { expireOverdueJobs } from "@/lib/generation-queue";

function readable(value: unknown) {
  return typeof value === "string" ? value : Array.isArray(value) ? value.join("、") : value ? JSON.stringify(value) : "";
}
export async function productSnapshot(id: string) {
  await expireOverdueJobs();
  const product = await db.product.findUnique({ where: { id }, include: {
    assets: { where: { type: "photo", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, width: true, height: true } },
    generationJobs: { take: 50, orderBy: { createdAt: "desc" }, select: { id: true, logicalModel: true, provider: true, model: true, input: true, externalTaskId: true, status: true, cost: true, costCurrency: true, costEstimated: true, fallback: true, reservedCredits: true, resultAssetIds: true, error: true, createdAt: true, startedAt: true, completedAt: true } },
  } });
  if (!product) return null;
  return {
    id: product.id, sku: product.sku, name: product.name, category: product.category,
    dimensions: readable(product.dimensions), colors: readable(product.colors), sellingPoints: readable(product.sellingPoints),
    materials: product.materials, complexity: product.complexity, identityTraits: product.identityTraits || "", photos: product.assets,
    jobs: product.generationJobs.map((job) => ({
      id: job.id, logicalModel: job.logicalModel, provider: job.provider, model: job.model, taskId: job.externalTaskId,
      resolution: (job.input as Record<string, unknown>)?.resolution as string ?? "",
      aspectRatio: (job.input as Record<string, unknown>)?.aspect_ratio as string ?? "",
      sceneIntent: (job.input as Record<string, unknown>)?.sceneIntent as string ?? "",
      editIntent: (job.input as Record<string, unknown>)?.editIntent as string ?? "",
      sourceJobId: (job.input as Record<string, unknown>)?.sourceJobId as string ?? null,
      sourceAssetId: (job.input as Record<string, unknown>)?.sourceAssetId as string ?? null,
      status: job.status, cost: job.cost === null ? null : Number(job.cost), costCurrency: job.costCurrency, costEstimated: job.costEstimated, fallback: job.fallback, reservedCredits: job.reservedCredits, error: job.error,
      resultAssetIds: Array.isArray(job.resultAssetIds) ? job.resultAssetIds.filter((value): value is string => typeof value === "string") : [],
      createdAt: job.createdAt.toISOString(), startedAt: job.startedAt?.toISOString() ?? null, completedAt: job.completedAt?.toISOString() ?? null,
    })),
  };
}
export type ProductSnapshot = NonNullable<Awaited<ReturnType<typeof productSnapshot>>>;
