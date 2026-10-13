import "server-only";
import { db } from "./db";
import { chatWithGateway } from "./llm-router";
import { identityPrompt, identitySchema, identityText } from "@/prompts/identity";
import { StudioError } from "./studio-error";
import { GatewayError } from "./gateway-error";

export async function analyzeProductIdentity(userId: string, productId: string) {
  const product = await db.product.findUnique({ where: { id: productId }, include: { assets: { where: { type: "photo", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }], take: 3 } } });
  if (!product) throw new StudioError("商品不存在", 404);
  if (product.assets.length < 2) throw new StudioError("AI 提炼需要至少 2 张不同角度实拍图，请先上传");
  // 避免多次点击产生并行付费调用；失败或超时记录完成后可以重试。
  const recent = await db.llmCall.findFirst({ where: { productId, logicalModel: "llm-vision", status: "running", createdAt: { gt: new Date(Date.now() - 90_000) } } });
  if (recent) throw new StudioError("该商品正在提炼中，请等待当前请求返回后再试", 409);
  const input = identityPrompt({ sku: product.sku, name: product.name, category: product.category, dimensions: product.dimensions, colors: product.colors, materials: product.materials, sellingPoints: product.sellingPoints }, product.assets.map(a => a.id));
  const response = await chatWithGateway("llm-vision", input, { userId, productId, validate(result, candidate) {
    const parsed = identitySchema.safeParse(result.json);
    if (!parsed.success || identityText(parsed.data).length > 10000) throw new GatewayError(candidate.provider, "AI 返回的产品特征格式无效或过长，请重试", 500, true);
  } });
  return { text: identityText(identitySchema.parse(response.result.json)), analysis: response.result.json, provider: response.candidate.provider, model: response.candidate.model, fallback: response.fallback, warnings: response.warnings, callId: response.attemptId };
}
