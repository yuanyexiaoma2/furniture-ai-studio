export type GatewayName = "kie" | "zenmux";
export function safeGatewayMessage(value: unknown) {
  let text = typeof value === "string" ? value : "未知错误";
  for (const key of [process.env.KIE_API_KEY, process.env.ZENMUX_API_KEY]) if (key?.trim()) text = text.split(key.trim()).join("[密钥已隐藏]");
  return text.replace(/Bearer\s+\S+/gi, "Bearer [已隐藏]").replace(/([?&](?:key|api_key|token)=)[^&\s]+/gi, "$1[已隐藏]").slice(0, 400);
}
export class GatewayError extends Error {
  cost?: import("./image-provider").GatewayCost;
  usage?: import("./image-provider").TokenUsage;
  externalGenerationId?: string;
  constructor(public provider: GatewayName, message: string, public status = 500, public retryable = status === 429 || status >= 500, public uncertain = false) {
    const label = provider === "kie" ? "KIE" : "ZenMux";
    const clean = safeGatewayMessage(message).replace(new RegExp(`^(?:${label}：)+`), "");
    super(`${label}：${clean}`);
  }
}
export class ImageTaskFailure extends GatewayError {}
export class ImageResultTransferFailure extends GatewayError {}
export function switchableGatewayFailure(error:GatewayError){
 if([400,401,402,403,404,409,413,422].includes(error.status)||/insufficient|quota|余额不足|积分不足|额度不足|配额不足|safety|content.?filter|content.?policy|审核|安全策略|invalid.*(?:parameter|argument)|参数.*(?:错误|无效)/i.test(error.message))return false;
 return error.retryable;
}
export function gatewayException(provider: GatewayName, error: unknown): GatewayError {
  if (error instanceof GatewayError) return error;
  const detail = error as { status?: number; code?: number; message?: string; name?: string };
  const status = Number(detail?.status ?? detail?.code) || 500;
  const network = detail?.name === "AbortError" || detail?.name === "TimeoutError" || !detail?.status && !detail?.code;
  return new GatewayError(provider, network ? "网络超时或连接失败" : status === 401 || status === 403 ? "密钥无效或没有访问权限，请检查配置并重启" : status === 429 ? "请求限流，请稍后重试" : `服务请求失败（${status}）：${safeGatewayMessage(detail?.message)}`, status, network || status === 429 || status >= 500, network);
}
