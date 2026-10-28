import "server-only";
import OpenAI from "openai";
import { assetBytes } from "@/lib/asset-bytes";
import { gatewayException, GatewayError } from "@/lib/gateway-error";
import { withImages, parseChatReply } from "@/lib/llm-format";
import type { LLMProvider, LLMInput } from "@/lib/llm-provider";
import { models, LLM_OUTPUT_BUDGET } from "./models.config";

type Body = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
export class ZenMuxLLMProvider implements LLMProvider {
  constructor(private model = models["llm-vision"].find(c => c.provider === "zenmux")!.model, private complete?: (body: Body) => Promise<unknown>, private read = assetBytes) {}
  isConfigured() { return Boolean(process.env.ZENMUX_API_KEY?.trim()); }
  async chat(input: LLMInput) {
    if (!this.isConfigured()) throw new GatewayError("zenmux", "未配置 ZENMUX_API_KEY", 503, false);
    let reply: unknown;
    try {
      const urls = await Promise.all((input.images ?? []).map(async ({ id }) => { const { bytes, mime } = await this.read(id); return `data:${mime};base64,${bytes.toString("base64")}`; }));
      const body: Body = { model: this.model, messages: withImages(input, urls) as Body["messages"], stream: false, max_completion_tokens: input.maxOutputTokens ?? LLM_OUTPUT_BUDGET, ...(input.responseFormat ? { response_format: input.responseFormat as Body["response_format"] } : {}), ...(input.tools?.length ? { tools: input.tools, tool_choice: "auto" } : {}) };
      if(input.webSearch)body.web_search_options={search_context_size:"low"};
      if (input.onDelta && !this.complete) {
        const stream = await new OpenAI({ apiKey: process.env.ZENMUX_API_KEY!.trim(), baseURL: process.env.ZENMUX_BASE_URL?.trim() || "https://zenmux.ai/api/v1", timeout: 90000, maxRetries: 0 }).chat.completions.create({ ...body, stream: true, stream_options: { include_usage: true } });
        const calls = new Map<number, { id: string; type: "function"; function: { name: string; arguments: string } }>(); let text = ""; let usage; let id;
        for await (const chunk of stream) { id = chunk.id; usage = chunk.usage ?? usage; const delta = chunk.choices[0]?.delta; if (delta?.content) { text += delta.content; input.onDelta(delta.content); } for (const c of delta?.tool_calls ?? []) { const old = calls.get(c.index) ?? { id: "", type: "function" as const, function: { name: "", arguments: "" } }; old.id = c.id ?? old.id; old.function.name += c.function?.name ?? ""; old.function.arguments += c.function?.arguments ?? ""; calls.set(c.index, old); } }
        return parseChatReply({ id, usage, choices: [{ message: { content: text, tool_calls: [...calls.values()] } }] }, input, "zenmux");
      }
      const response = this.complete ? await this.complete(body) : await new OpenAI({ apiKey: process.env.ZENMUX_API_KEY!.trim(), baseURL: process.env.ZENMUX_BASE_URL?.trim() || "https://zenmux.ai/api/v1", timeout: 25000, maxRetries: 0 }).chat.completions.create(body);
      reply = response;
      return parseChatReply(response, input, "zenmux");
    } catch (error) { const failure = gatewayException("zenmux", error); const id = (reply as { id?: unknown } | undefined)?.id; if (typeof id === "string") failure.externalGenerationId = id; throw failure; }
  }
}
