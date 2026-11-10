import "server-only";
import type { Prisma } from "@/generated/prisma/client";

// 调度器也更新同一任务行；锁内核对尝试归属，防止旧请求覆盖新线路。
export async function lockGenerationAttempt(tx: Prisma.TransactionClient, jobId: string, attemptId: string, statuses = ["running", "pending"]) {
  await tx.$queryRaw`SELECT id FROM "GenerationJob" WHERE id=${jobId} FOR UPDATE`;
  const job = await tx.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  const attempt = await tx.generationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  if (job.status !== "running" || attempt.jobId !== jobId || !statuses.includes(attempt.status)
    || job.provider !== attempt.provider || job.model !== attempt.model
    || (attempt.externalTaskId !== null && job.externalTaskId !== attempt.externalTaskId)) return null;
  return { job, attempt };
}
