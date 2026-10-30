import "server-only";
import { db } from "./db";
import { databaseCircuit, gatewayCircuitState } from "./gateway-circuit";
import { gatewayConfigured, gatewayPreference, candidatesFor } from "./gateway-router";
import { models, type LogicalModel } from "./models.config";
import type { GatewayName } from "./gateway-error";

export async function gatewayStatus() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const gateways = await Promise.all((["zenmux", "kie"] as GatewayName[]).map(async provider => {
    const [images, llms, open, circuit] = await Promise.all([
      db.generationAttempt.findMany({ where: { provider, createdAt: { gte: since } },include:{job:{select:{input:true}}} }),
      db.llmCall.findMany({ where: { provider, createdAt: { gte: since } } }),
      databaseCircuit.isOpen(provider), gatewayCircuitState(provider),
    ]);
    const rows = [...images, ...llms], completed = rows.filter(r => r.status === "success" || r.status === "failed");
    const timed = completed.filter(r => r.durationMs !== null);
    const totals: Record<string, { amount: number; estimated: number }> = {};
    const billable=[...images.filter(r=>!(r.job.input as Record<string,unknown>).chargeSuccessfulAttemptOnly||r.status==="success"),...llms];
    for (const row of billable) if (row.costUsd !== null) { const total = totals.USD ??= { amount: 0, estimated: 0 }; total.amount += Number(row.costUsd); if (row.costEstimated) total.estimated += Number(row.costUsd); }
    const last = [...completed].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return { provider, configured: gatewayConfigured(provider), open, openUntil: circuit?.openUntil?.toISOString() ?? null, calls: rows.length, imageCalls: images.length, llmCalls: llms.length, active: rows.length - completed.length,
      successRate: completed.length ? Math.round(100 * completed.filter(r => r.status === "success").length / completed.length) : null,
      averageMs: timed.length ? Math.round(timed.reduce((sum, row) => sum + row.durationMs!, 0) / timed.length) : null,
      totals, rawCredits: rows.reduce((sum, row) => sum + Number(row.credits ?? 0), 0), pendingBills: rows.filter(r => r.billingState === "pending").length, unresolvedBills: rows.filter(r => r.billingState === "unavailable").length, unknownCost: rows.filter(r => r.costUsd === null).length, lastError: last?.status === "failed" ? last.error : null,
    };
  }));
  return { gateways, preference: gatewayPreference(), routes: (Object.keys(models) as LogicalModel[]).map(logical => ({ logical, candidates: candidatesFor(logical) })) };
}
export type GatewayStatus = Awaited<ReturnType<typeof gatewayStatus>>;
