import "server-only";
import OpenAI from "openai";
import { assetBytes } from "@/lib/asset-bytes";
import { gatewayException, GatewayError } from "@/lib/gateway-error";
import { withImages, parseChatReply } from "@/lib/llm-format";
import type { LLMProvider, LLMInput } from "@/lib/llm-provider";

type Body = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
export class ZenMuxLLMProvider implements LLMProvider {
  constructor(private model = "google/gemini-2.5-pro", private complete?: (body: Body) => Promise<unknown>, private read = assetBytes) {}
  isConfigured() { return Boolean(process.env.ZENMUX_API_KEY?.trim()); }
  async chat(input: LLMInput) {
    if (!this.isConfigured()) throw new GatewayError("zenmux", "未配置 ZENMUX_API_KEY", 503, false);
    try {
      const urls = await Promise.all((input.images ?? []).map(async ({ id }) => { const { bytes, mime } = await this.read(id); return `data:${mime};base64,${bytes.toString("base64")}`; }));
      const body: Body = { model: this.model, messages: withImages(input, urls) as Body["messages"], stream: false, max_completion_tokens: 2200, ...(input.responseFormat ? { response_format: input.responseFormat as Body["response_format"] } : {}), ...(input.tools?.length ? { tools: input.tools, tool_choice: "auto" } : {}) };
      const response = this.complete ? await this.complete(body) : await new OpenAI({ apiKey: process.env.ZENMUX_API_KEY!.trim(), baseURL: process.env.ZENMUX_BASE_URL?.trim() || "https://zenmux.ai/api/v1", timeout: 25000, maxRetries: 0 }).chat.completions.create(body);
      return parseChatReply(response, input, "zenmux");
    } catch (error) { throw gatewayException("zenmux", error); }
  }
}
