import "server-only";
import { db } from "./db";
import { roundUsd,imageAttemptTotals } from "./gateway-cost";
import { gatewayConfigured } from "./gateway-router";
import type { Prisma } from "@/generated/prisma/client";

export function parseZenMuxBill(raw: unknown, id: string, model: string): number | null {
  const data = raw as { generationId?: unknown; model?: unknown; usage?: unknown; ratingResponses?: { billAmount?: unknown } };
  if (data?.generationId !== id || data?.model !== model) return null;
  const amount = data.ratingResponses?.billAmount ?? data.usage;
  return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? roundUsd(amount) : null;
}
export async function queryZenMuxBill(id: string, model: string, fetcher = fetch) {
  const base = process.env.ZENMUX_BASE_URL?.trim() || "https://zenmux.ai/api/v1";
  const reply = await fetcher(`${base.replace(/\/$/, '')}/management/generation?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${process.env.ZENMUX_API_KEY?.trim()}` }, signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!reply.ok) throw new Error("ZenMux 账单查询尚不可用");
  const raw = await reply.json(); const amount = parseZenMuxBill(raw, id, model);
  // 仅保存已验证的计费字段，避免保留无关敏感响应。
  const safe = { generationId: raw.generationId, model: raw.model, usage: raw.usage ?? null, ratingResponses: raw.ratingResponses ?? null } as Prisma.InputJsonValue;
  return { amount, raw: safe };
}
export async function reconcileZenMuxCosts(fetcher = fetch, now = new Date()) {
  if (!gatewayConfigured("zenmux")) return;
  const where = { provider: "zenmux", billingState: "pending", nextBillingAt: { lte: now }, externalGenerationId: { not: null } };
  const [images, llms] = await Promise.all([db.generationAttempt.findMany({ where, take: 20 }), db.llmCall.findMany({ where, take: 20 })]);
  for (const record of [...images.map(row => ({ kind: "image" as const, row })), ...llms.map(row => ({ kind: "llm" as const, row }))]) {
    const { row, kind } = record;
    try {
      // 事务级锁跨进程去重；账单查询只读，不触发新的生成收费。
      await db.$transaction(async tx => {
        const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${`billing:${kind}:${row.id}`},0)) AS locked`;
        if (!lock.locked) return;
        const latest = kind === "image" ? await tx.generationAttempt.findUniqueOrThrow({ where: { id: row.id } }) : await tx.llmCall.findUniqueOrThrow({ where: { id: row.id } });
        if (latest.billingState !== "pending" || !latest.nextBillingAt || latest.nextBillingAt > now) return;
        let bill: Awaited<ReturnType<typeof queryZenMuxBill>> | undefined;
        try { bill = await queryZenMuxBill(row.externalGenerationId!, row.model, fetcher); } catch { /* 计费延迟或网络失败均保持预估。 */ }
        const checks = latest.billingChecks + 1;
        const settled = bill?.amount !== null && bill?.amount !== undefined;
        const data = { billingChecks: checks, billingState: settled ? "settled" : checks >= 10 ? "unavailable" : "pending", nextBillingAt: settled || checks >= 10 ? null : new Date(now.getTime() + Math.min(60, 5 * 2 ** checks) * 60_000), ...(settled ? { costUsd: bill!.amount!, costEstimated: false, billingJson: bill!.raw } : {}) };
        if (kind === "llm") await tx.llmCall.update({ where: { id: row.id }, data });
        else {
          await tx.generationAttempt.update({ where: { id: row.id }, data });
          const attempts = await tx.generationAttempt.findMany({ where: { jobId: (row as typeof images[number]).jobId } });
          const job=await tx.generationJob.findUniqueOrThrow({where:{id:(row as typeof images[number]).jobId}});
          await tx.generationJob.update({ where: { id: job.id }, data:imageAttemptTotals(job.input as Record<string,unknown>,attempts) });
        }
      }, { timeout: 15_000 });
    } catch { /* 单条失败不阻塞后续账单和 worker 的生图轮询。 */ }
  }
}
