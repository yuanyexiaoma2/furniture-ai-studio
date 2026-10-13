import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { candidatesFor, gatewayConfigured } from "./gateway-router";
import { databaseCircuit } from "./gateway-circuit";
import { StudioError } from "./studio-error";
import type { LogicalModel } from "./models.config";
export function quotaMonth(now = new Date()) {
  const local = new Date(now.getTime() + 8 * 3600000), year = local.getUTCFullYear(), month = local.getUTCMonth();
  return { start: new Date(Date.UTC(year, month, 1) - 8 * 3600000), end: new Date(Date.UTC(year, month + 1, 1) - 8 * 3600000) };
}
export async function monthlySpendUsd(client: Prisma.TransactionClient | typeof db, userId: string, exclude?: { jobId?: string; callId?: string }) {
  const month = quotaMonth();
  const [row] = await client.$queryRaw<{ amount: Prisma.Decimal }[]>`SELECT COALESCE(SUM(amount),0) AS amount FROM (
    SELECT CASE WHEN status IN ('pending','running') THEN GREATEST(COALESCE("costUsd",0),"reservedUsd") ELSE COALESCE("costUsd","reservedUsd") END AS amount FROM "GenerationJob" WHERE "createdById"=${userId} AND "createdAt">=${month.start} AND "createdAt"<${month.end} AND id<>${exclude?.jobId ?? ''}
    UNION ALL
    SELECT CASE WHEN status='running' THEN GREATEST(COALESCE("costUsd",0),"reservedUsd") ELSE COALESCE("costUsd","reservedUsd") END FROM "LlmCall" WHERE "createdById"=${userId} AND "createdAt">=${month.start} AND "createdAt"<${month.end} AND id<>${exclude?.callId ?? ''}
  ) totals`;
  return Number(row.amount);
}
export async function configuredCandidate(logical: LogicalModel) {
  for (const candidate of candidatesFor(logical)) if (gatewayConfigured(candidate.provider) && !await databaseCircuit.isOpen(candidate.provider)) return candidate;
  throw new StudioError("没有可用网关，可能未配置或暂时熔断，请稍后再试", 503);
}
export async function assertUsdQuota(tx: Prisma.TransactionClient, userId: string, estimate: number, exclude?: { jobId?: string; callId?: string }) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "viewer") throw new StudioError("只读成员不能生成图片或调用 AI", 403);
  const used = await monthlySpendUsd(tx, userId, exclude);
  if (used + estimate > Number(user.monthlyQuota) + 0.0000001) throw new StudioError(`本月美元配额不足：已消耗或预留 $${used.toFixed(6)}，本次预估 $${estimate.toFixed(6)}，配额 $${Number(user.monthlyQuota).toFixed(6)}，还差 $${(used + estimate - Number(user.monthlyQuota)).toFixed(6)}`, 409);
}
