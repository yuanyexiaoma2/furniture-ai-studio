import type { GatewayCost, TokenUsage } from "@/lib/image-provider";
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type LLMPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type LLMMessage = { role: "system" | "user" | "assistant"; content: string | LLMPart[]; tool_calls?: ToolCall[] } | { role: "tool"; content: string; tool_call_id: string };
export type LLMTool = { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } };
export type ResponseFormat = { type: "json_object" } | { type: "json_schema"; json_schema: { name: string; strict?: boolean; schema: Record<string, unknown> } };
export type LLMInput = { messages: LLMMessage[]; onDelta?: (text: string) => void; maxOutputTokens?: number; images?: { id: string }[]; tools?: LLMTool[]; responseFormat?: ResponseFormat; webSearch?: boolean };
export type LLMResult = { text: string; json?: unknown; toolCalls?: ToolCall[]; sources?: {title:string;url:string;content:string}[]; usage: TokenUsage; cost?: GatewayCost; externalGenerationId?: string };
export interface LLMProvider { isConfigured(): boolean; chat(input: LLMInput): Promise<LLMResult> }
