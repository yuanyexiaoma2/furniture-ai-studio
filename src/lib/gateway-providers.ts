import "server-only";
import type { ModelCandidate } from "./models.config";
import { KieProvider } from "./kie-provider";
import { ZenMuxImageProvider } from "./zenmux-image-provider";
import { KieLLMProvider } from "./kie-llm-provider";
import { ZenMuxLLMProvider } from "./zenmux-llm-provider";
import type { ImageProvider } from "./image-provider";
export function imageProvider(candidate: ModelCandidate): ImageProvider { return candidate.provider === "kie" ? new KieProvider(candidate.model) : new ZenMuxImageProvider(candidate.model); }
export function llmProvider(candidate: ModelCandidate) { return candidate.provider === "kie" ? new KieLLMProvider({ model: candidate.model, endpoint: candidate.endpoint!, protocol: candidate.protocol ?? "chat", supportsTools: candidate.supportsTools }) : new ZenMuxLLMProvider(candidate.model); }
