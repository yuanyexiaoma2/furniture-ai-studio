import "server-only";
import { db } from "./db";
import { databaseCircuit } from "./gateway-circuit";
import { candidatesFor, routeCall } from "./gateway-router";
import { llmProvider } from "./gateway-providers";
import type { LLMInput, LLMResult } from "./llm-provider";
import type { GatewayName } from "./gateway-error";
import type { ModelCandidate } from "./models.config";
import { StudioError } from "./studio-error";
import { gatewayException } from "./gateway-error";
import { assertUsdQuota } from "./quota";
import { costFields, estimateLlmUsd, imageInputTokens } from "./gateway-cost";

export async function chatWithGateway(logical: "llm-vision" | "llm-agent", input: LLMInput, context: { userId: string; productId?: string; provider?: GatewayName; validate?: (result: LLMResult, candidate: ModelCandidate) => void }) {
  const photos = await db.asset.findMany({ where: { id: { in: (input.images ?? []).map(p => p.id) } }, select: { width: true, height: true } });
  const inputEstimate = JSON.stringify(input.messages).length + imageInputTokens(photos);
  return routeCall({ logical, circuit: databaseCircuit, probe: Boolean(context.provider), candidates: context.provider ? candidatesFor(logical).filter(c => c.provider === context.provider) : undefined,
    async call(candidate) { const result = await llmProvider(candidate).chat(input); try { context.validate?.(result, candidate); } catch (error) { const failure = gatewayException(candidate.provider, error); Object.assign(failure, { cost: result.cost, usage: result.usage, externalGenerationId: result.externalGenerationId }); throw failure; } return result; },
    hooks: {
      async start(candidate, fallback) {
        return db.$transaction(async tx => {
          const estimate = estimateLlmUsd(candidate, inputEstimate);
          await assertUsdQuota(tx, context.userId, estimate);
          if (context.productId) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identity:${context.productId}`}, 0))`;
            if (await tx.llmCall.findFirst({ where: { productId: context.productId, logicalModel: logical, status: "running", createdAt: { gt: new Date(Date.now() - 90_000) } } })) throw new StudioError("该商品正在提炼中，请等待当前请求完成", 409);
          }
          return (await tx.llmCall.create({ data: { logicalModel: logical, provider: candidate.provider, model: candidate.model, fallback, createdById: context.userId, productId: context.productId, reservedUsd: estimate, costUsd: estimate, costEstimated: true } })).id;
        });
      },
      async success(id, result, durationMs) {
        const call = await db.llmCall.findUniqueOrThrow({ where: { id } });
        const candidate = candidatesFor(logical).find(c => c.provider === call.provider && c.model === call.model)!;
        const estimate = result.usage.totalTokens ? estimateLlmUsd(candidate, result.usage.inputTokens, result.usage.outputTokens) : Number(call.reservedUsd);
        await db.llmCall.update({ where: { id }, data: { status: "success", completedAt: new Date(), durationMs, ...costFields(result.cost, estimate), reservedUsd: 0, ...result.usage, externalGenerationId: result.externalGenerationId, ...(call.provider === "zenmux" ? { billingState: result.externalGenerationId ? "pending" : "unavailable", nextBillingAt: result.externalGenerationId ? new Date(Date.now() + 5 * 60_000) : null } : {}) } });
      },
      async failure(id, error, durationMs) { const call = await db.llmCall.findUniqueOrThrow({ where: { id } }); await db.llmCall.update({ where: { id }, data: { status: "failed", completedAt: new Date(), durationMs, error: error.message, ...costFields(error.cost, error.status < 500 && error.status !== 429 ? 0 : Number(call.reservedUsd)), reservedUsd: 0, ...(error.usage ?? {}), externalGenerationId: error.externalGenerationId, ...(call.provider === "zenmux" ? { billingState: error.externalGenerationId ? "pending" : "unavailable", nextBillingAt: error.externalGenerationId ? new Date(Date.now() + 5 * 60_000) : null } : {}) } }); },
    },
  });
}
