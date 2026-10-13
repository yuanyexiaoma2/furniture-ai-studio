import "server-only";
import { db } from "./db";
import { databaseCircuit } from "./gateway-circuit";
import { candidatesFor, routeCall } from "./gateway-router";
import { llmProvider } from "./gateway-providers";
import type { LLMInput, LLMResult } from "./llm-provider";
import type { GatewayName } from "./gateway-error";

export async function chatWithGateway(logical: "llm-vision" | "llm-agent", input: LLMInput, context: { userId: string; productId?: string; provider?: GatewayName; validate?: (result: LLMResult) => void }) {
  return routeCall({ logical, circuit: databaseCircuit, candidates: context.provider ? candidatesFor(logical).filter(c => c.provider === context.provider) : undefined,
    async call(candidate) { const result = await llmProvider(candidate).chat(input); context.validate?.(result); return result; },
    hooks: {
      async start(candidate, fallback) { return (await db.llmCall.create({ data: { logicalModel: logical, provider: candidate.provider, model: candidate.model, fallback, createdById: context.userId, productId: context.productId } })).id; },
      async success(id, result, durationMs) { await db.llmCall.update({ where: { id }, data: { status: "success", completedAt: new Date(), durationMs, cost: result.cost?.amount, currency: result.cost?.currency, costEstimated: result.cost?.estimated ?? false, ...result.usage } }); },
      async failure(id, error, durationMs) { await db.llmCall.update({ where: { id }, data: { status: "failed", completedAt: new Date(), durationMs, error: error.message } }); },
    },
  });
}
