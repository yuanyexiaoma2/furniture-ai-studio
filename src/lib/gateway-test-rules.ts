import {z} from "zod";
import {models} from "./models.config";
import {estimateImageUsd,estimateLlmUsd} from "./gateway-cost";
// confirmed仅兼容旧客户端，不再作为费用确认门槛；权限和额度仍由原接口校验。
export const gatewayTestSchema=z.object({provider:z.enum(["zenmux","kie"]),kind:z.enum(["llm","image"]),confirmed:z.boolean().optional()});
export function gatewayTestEstimate(provider:"zenmux"|"kie",kind:"llm"|"image"){
 const candidate=(kind==="image"?models["scene-main"]:models["llm-vision"]).find(c=>c.provider===(kind==="llm"?"zenmux":provider));
 if(!candidate)return null;
 return kind==="image"?estimateImageUsd(candidate,"1K"):estimateLlmUsd(candidate,100);
}
