import { GatewayError, type GatewayName } from "@/lib/gateway-error";
import type { LLMInput, LLMMessage, LLMResult, ToolCall } from "@/lib/llm-provider";

export function withImages(input: LLMInput, urls: string[]): LLMMessage[] {
  const messages = input.messages.map((message) => ({ ...message }));
  if (!urls.length) return messages;
  const last = messages.findLastIndex((message) => message.role === "user");
  if (last < 0) throw new GatewayError("kie", "图片输入需要一条用户消息", 400, false);
  const message = messages[last];
  const content = typeof message.content === "string" ? [{ type: "text" as const, text: message.content }] : [...message.content];
  messages[last] = { ...message, content: [...content, ...urls.map((url) => ({ type: "image_url" as const, image_url: { url } }))] } as LLMMessage;
  return messages;
}
export function structuredResult(text: string, input: LLMInput, provider: GatewayName) {
  if (!input.responseFormat) return {};
  try { return { json: JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as unknown }; }
  catch { throw new GatewayError(provider, "模型没有返回有效的结构化 JSON", 500, true); }
}
type ChatReply = { id?: string; choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null; tool_calls?: ToolCall[] } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; credits_consumed?: number };
export function parseChatReply(raw: unknown, input: LLMInput, provider: GatewayName): LLMResult {
  const reply = raw as ChatReply;
  const choice = reply.choices?.[0], message = choice?.message;
  if (choice?.finish_reason === "content_filter" || message?.refusal) throw new GatewayError(provider, "内容被安全策略拦截", 500, true);
  const text = typeof message?.content === "string" ? message.content : "";
  if (!text && !message?.tool_calls?.length) throw new GatewayError(provider, "模型返回为空，未获得文本或工具调用", 500, true);
  return { text, externalGenerationId: provider === "zenmux" ? reply.id : undefined, ...(text ? structuredResult(text, input, provider) : {}), ...(message?.tool_calls?.length ? { toolCalls: message.tool_calls } : {}), usage: { inputTokens: reply.usage?.prompt_tokens ?? 0, outputTokens: reply.usage?.completion_tokens ?? 0, totalTokens: reply.usage?.total_tokens ?? 0 }, ...(typeof reply.credits_consumed === "number" && Number.isFinite(reply.credits_consumed) && reply.credits_consumed >= 0 ? { cost: { amount: reply.credits_consumed, currency: "credits" as const } } : {}) };
}
