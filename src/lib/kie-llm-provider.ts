import "server-only";
import { KieProvider } from "@/lib/kie-provider";
import { kieRequest } from "@/lib/kie-http";
import { GatewayError, gatewayException } from "@/lib/gateway-error";
import { withImages, parseChatReply, structuredResult } from "@/lib/llm-format";
import type { LLMProvider, LLMInput, LLMResult, LLMMessage, ToolCall } from "@/lib/llm-provider";
import { models } from "./models.config";
import { kieCreditCost } from "./gateway-cost";

export type KieLLMConfig = { model: string; endpoint: string; protocol: "chat" | "responses"; supportsTools: boolean };
export class KieLLMProvider implements LLMProvider {
  constructor(private config: KieLLMConfig = defaultConfig(), private request = kieRequest, private upload = (id: string) => new KieProvider().uploadFile(id)) {}
  isConfigured() { return Boolean(process.env.KIE_API_KEY?.trim()); }
  async chat(input: LLMInput): Promise<LLMResult> {
    if (!this.isConfigured()) throw new GatewayError("kie", "未配置 KIE_API_KEY", 503, false);
    if (input.tools?.length && !this.config.supportsTools) throw new GatewayError("kie", "当前聊天模型未适配工具调用", 400, false);
    let reply: Record<string, unknown> | undefined;
    try {
      const urls = await Promise.all((input.images ?? []).map(({ id }) => this.upload(id)));
      const messages = withImages(input, urls);
      const body = this.config.protocol === "responses" ? {
        model: this.config.model, input: messages.flatMap(responseMessages), stream: false,
        ...(input.tools?.length ? { tools: input.tools.map((tool) => ({ type: "function", ...tool.function })), tool_choice: "auto" } : {}),
        ...(input.responseFormat ? { text: { format: input.responseFormat.type === "json_schema" ? { type: "json_schema", ...input.responseFormat.json_schema } : { type: "json_object" } } } : {}),
      } : { messages, stream: false, reasoning_effort: "low", ...(input.responseFormat ? { response_format: input.responseFormat } : {}), ...(input.tools?.length ? { tools: input.tools } : {}) };
      const base = process.env.KIE_BASE_URL?.trim();
      const endpoint = base ? new URL(new URL(this.config.endpoint).pathname, base).href : this.config.endpoint;
      const response = await this.request(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, { allowMissingCode: true, timeoutMs: 25000 });
      reply = response;
      return this.config.protocol === "responses" ? parseResponses(response, input) : parseChatReply(response, input, "kie");
    } catch (error) { const failure = gatewayException("kie", error); failure.cost ??= kieCreditCost(reply?.credits_consumed); throw failure; }
  }
}
function defaultConfig(): KieLLMConfig { const c = models["llm-vision"].find(c => c.provider === "kie")!; return { model: c.model, endpoint: c.endpoint!, protocol: c.protocol ?? "chat", supportsTools: c.supportsTools }; }
function responseMessages(message: LLMMessage): Record<string, unknown>[] {
  if (message.role === "tool") return [{ type: "function_call_output", call_id: message.tool_call_id, output: message.content }];
  const parts = typeof message.content === "string" ? [{ type: "text" as const, text: message.content }] : message.content;
  const content = parts.map((part) => part.type === "text" ? { type: "input_text", text: part.text } : { type: "input_image", image_url: part.image_url.url });
  const result: Record<string, unknown>[] = content.length ? [{ role: message.role, content }] : [];
  for (const call of message.tool_calls ?? []) result.push({ type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments });
  return result;
}
function parseResponses(raw: unknown, input: LLMInput): LLMResult {
  const reply = raw as { status?: string; output?: { type?: string; call_id?: string; name?: string; arguments?: string; content?: { type?: string; text?: string }[] }[]; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }; credits_consumed?: number };
  if (reply.status === "failed" || reply.status === "incomplete") throw new GatewayError("kie", "模型未完成响应", 500, true);
  const text = (reply.output ?? []).flatMap((item) => (item.content ?? []).filter((part) => part.type === "output_text").map((part) => part.text ?? "")).join("\n");
  const toolCalls: ToolCall[] = (reply.output ?? []).filter((item) => item.type === "function_call" && item.call_id && item.name).map((item) => ({ id: item.call_id!, type: "function", function: { name: item.name!, arguments: item.arguments ?? "{}" } }));
  if (!text && !toolCalls.length) throw new GatewayError("kie", "模型返回为空", 500, true);
  return { text, ...(text ? structuredResult(text, input, "kie") : {}), ...(toolCalls.length ? { toolCalls } : {}), usage: { inputTokens: reply.usage?.input_tokens ?? 0, outputTokens: reply.usage?.output_tokens ?? 0, totalTokens: reply.usage?.total_tokens ?? 0 }, cost: kieCreditCost(reply.credits_consumed) };
}
