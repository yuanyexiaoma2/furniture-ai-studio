import { NextResponse } from "next/server";
import { z } from "zod";
import { fromPrisma } from "pg-boss";
import { db } from "@/lib/db";
import { studioUser, studioError, StudioError } from "@/lib/studio-api";
import { chatWithGateway } from "@/lib/llm-router";
import { gatewayConfigured, candidatesFor } from "@/lib/gateway-router";
import { getBoss, SUBMIT_QUEUE, workerIsReady } from "@/lib/generation-queue";
import { assertUsdQuota } from "@/lib/quota";
import { estimateImageUsd } from "@/lib/gateway-cost";
const schema = z.object({ provider: z.enum(["zenmux", "kie"]), kind: z.enum(["llm", "image"]), confirmed: z.literal(true) });
export async function POST(request: Request) {
  try {
    const user = await studioUser(request, true); if (user.role !== "admin") throw new StudioError("只有管理员可以测试网关", 403);
    const input = schema.safeParse(await request.json().catch(() => null)); if (!input.success) throw new StudioError("请确认测试会产生费用并选择网关");
    const { provider, kind } = input.data; if (!gatewayConfigured(provider)) throw new StudioError(`${provider === "kie" ? "KIE" : "ZenMux"} 未配置，请填写 Key 后重启`, 503);
    if (kind === "llm") {
      const reply = await chatWithGateway("llm-vision", { messages: [{ role: "user", content: "你好，请用一句简短中文回应。" }] }, { userId: user.id, provider });
      return NextResponse.json({ message: reply.result.text, provider: reply.candidate.provider, fallback: reply.fallback });
    }
    if (!await workerIsReady()) throw new StudioError("生图 worker 未启动，请先运行 npm run worker", 503);
    const boss = await getBoss();
    const job = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const prompt = "A simple wooden stool on a plain white background, studio product photograph, no text.";
      const candidate = candidatesFor("scene-main").find(c => c.provider === provider)!;
      const estimate = estimateImageUsd(candidate, "1K", prompt);
      await assertUsdQuota(tx, user.id, estimate);
      const job = await tx.generationJob.create({ data: { createdById: user.id, logicalModel: "scene-main", reservedUsd: estimate, input: { testProvider: provider, prompt, referenceAssetIds: [], aspect_ratio: "1:1", resolution: "1K", output_format: "png", submissionAttempted: false } } });
      if (!await boss.send(SUBMIT_QUEUE, { jobId: job.id }, { db: fromPrisma(tx) })) throw new StudioError("测试未能入队，请稍后重试", 503);
      return job;
    });
    return NextResponse.json({ jobId: job.id, message: "1K 测试已提交，请等待生成并转存；网关状态中会更新结果。" }, { status: 202 });
  } catch (error) { return studioError(error, "网关测试失败，请检查服务配置后重试"); }
}
