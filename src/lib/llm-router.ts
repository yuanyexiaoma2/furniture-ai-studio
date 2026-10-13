import "server-only";
import { db } from "./db";
import { databaseCircuit } from "./gateway-circuit";
import { candidatesFor, routeCall } from "./gateway-router";
import { llmProvider } from "./gateway-providers";
import type { LLMInput, LLMResult } from "./llm-provider";
import type { GatewayName } from "./gateway-error";
import type { ModelCandidate } from "./models.config";
import { StudioError } from "./studio-error";

export async function chatWithGateway(logical: "llm-vision" | "llm-agent", input: LLMInput, context: { userId: string; productId?: string; provider?: GatewayName; validate?: (result: LLMResult, candidate: ModelCandidate) => void }) {
  return routeCall({ logical, circuit: databaseCircuit, probe: Boolean(context.provider), candidates: context.provider ? candidatesFor(logical).filter(c => c.provider === context.provider) : undefined,
    async call(candidate) { const result = await llmProvider(candidate).chat(input); context.validate?.(result, candidate); return result; },
    hooks: {
      async start(candidate, fallback) {
        return db.$transaction(async tx => {
          if (context.productId) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`identity:${context.productId}`}, 0))`;
            if (await tx.llmCall.findFirst({ where: { productId: context.productId, logicalModel: logical, status: "running", createdAt: { gt: new Date(Date.now() - 90_000) } } })) throw new StudioError("该商品正在提炼中，请等待当前请求完成", 409);
          }
          return (await tx.llmCall.create({ data: { logicalModel: logical, provider: candidate.provider, model: candidate.model, fallback, createdById: context.userId, productId: context.productId } })).id;
        });
      },
      async success(id, result, durationMs) { await db.llmCall.update({ where: { id }, data: { status: "success", completedAt: new Date(), durationMs, cost: result.cost?.amount, currency: result.cost?.currency, costEstimated: result.cost?.estimated ?? false, ...result.usage } }); },
      async failure(id, error, durationMs) { await db.llmCall.update({ where: { id }, data: { status: "failed", completedAt: new Date(), durationMs, error: error.message } }); },
    },
  });
}
