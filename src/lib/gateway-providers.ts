import "server-only";
import type { ModelCandidate } from "./models.config";
import { KieProvider } from "./kie-provider";
import { ZenMuxImageProvider } from "./zenmux-image-provider";
import {GatewayError} from "./gateway-error";
import { ZenMuxLLMProvider } from "./zenmux-llm-provider";
import type { ImageProvider } from "./image-provider";
export function imageProvider(candidate: ModelCandidate): ImageProvider { return candidate.provider === "kie" ? new KieProvider(candidate.model) : new ZenMuxImageProvider(candidate.model); }
export function llmProvider(candidate: ModelCandidate) { if(candidate.provider!=="zenmux")throw new GatewayError("zenmux","智能体只允许ZenMux，不会回退KIE",400,false);return new ZenMuxLLMProvider(candidate.model); }
