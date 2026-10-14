import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { db } from "@/lib/db";
import { GatewayError, safeGatewayMessage } from "@/lib/gateway-error";
import { kieCreditCost } from "./gateway-cost";

export class KieError extends GatewayError {
  businessFailure = false;
  constructor(message: string, public code: number = 500, uncertain = false) { super("kie", message, code >= 400 && code <= 599 ? code : 502, code === 429 || code < 400 || code >= 500, uncertain); }
}

export function safeKieMessage(message: unknown, key = process.env.KIE_API_KEY || "") {
  let text = typeof message === "string" ? message : "未知错误";
  if (key) text = text.split(key).join("[密钥已隐藏]");
  return safeGatewayMessage(text).slice(0, 300);
}

export function referenceImageUnavailable(detail: unknown) {
  const msg = safeKieMessage(detail);
  return /(?:参考图|图片地址|图像地址|图片链接).*(?:过期|失效|无法|下载失败|访问失败)|(?:reference|input|image|file|url).{0,100}(?:expired|unreachable|not accessible|cannot (?:access|download|fetch)|failed to (?:download|fetch)|download (?:failed|failure))|(?:failed to (?:download|fetch)|cannot (?:download|fetch)|download failed).{0,100}(?:image|reference|url|file)/i.test(msg);
}
export class ReferenceImageFailure extends GatewayError {
  constructor(public detail: string, public cost?: import("./image-provider").GatewayCost) { super("kie", "参考图链接失效或无法下载，需要重新上传实拍图", 422, false); }
}
export function kieFailure(code: number, detail?: unknown) {
  const msg = safeKieMessage(detail);
  if (referenceImageUnavailable(msg)) return new ReferenceImageFailure(msg);
  if (/insufficient (?:balance|credits?|funds)|not enough (?:balance|credits?|funds)|balance|credits? (?:exhausted|depleted)|余额不足|积分不足/i.test(msg)) return new KieError("账户余额不足，请充值后重试", 402);
  if (/content.*(?:block|filter|prohibit)|safety|policy|违规|内容.*拦截|安全.*拦截/i.test(msg)) return new KieError("内容被安全策略拦截，请调整提示词后重试", 500);
  if (code === 401 || code === 403) return new KieError("KIE 密钥无效或无访问权限，请检查 KIE_API_KEY 后重新生成", code);
  if (code === 402) return new KieError("KIE 账户积分不足，请充值后重新生成", code);
  if (code === 429) return new KieError("KIE 请求过于频繁，退避重试后仍未成功，请稍后重新生成", code);
  if (code === 422 || code === 400 || /invalid.*(?:parameter|argument)|parameter.*(?:invalid|required)|missing.*(?:field|parameter)/i.test(msg)) return new KieError("参数或任务无效，请检查提示词、参考图、比例及分辨率", code === 422 ? 422 : 400);
  return new KieError(`服务请求失败（${code}）：${/[\u3400-\u9fff]/.test(msg) ? msg : '上游服务异常，请稍后重试或联系管理员核对网关记录'}`, code);
}

// 数据库预留请求时刻，跨 web / worker / 重试共享，550ms 间隔使任意 10 秒内最多 19 次。
export async function reserveKieRequest() {
  const wait = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(8121202)`;
    const row = await tx.providerRateLimit.findUnique({ where: { id: "kie" } });
    const now = Date.now();
    const at = Math.max(now, row?.nextAllowedAt.getTime() ?? 0);
    await tx.providerRateLimit.upsert({ where: { id: "kie" }, create: { id: "kie", nextAllowedAt: new Date(at + 550) }, update: { nextAllowedAt: new Date(at + 550) } });
    return at - now;
  });
  if (wait > 0) await delay(wait);
}

type Options = { onDelta?: (text: string) => void; key?: string; fetcher?: typeof fetch; beforeRequest?: () => Promise<void>; sleep?: (ms: number) => Promise<unknown>; allowMissingCode?: boolean; timeoutMs?: number };
export async function kieRequest(url: string, init: RequestInit, options: Options = {}) {
  const key = options.key ?? process.env.KIE_API_KEY?.trim();
  if (!key) throw new KieError("尚未配置 KIE_API_KEY，请管理员在 .env 填写密钥后重启网页与 worker", 401);
  const attempts = options.allowMissingCode ? 1 : 5;
  for (let attempt = 0; attempt < attempts; attempt++) {
    await (options.beforeRequest ?? reserveKieRequest)();
    let response: Response;
    try {
      response = await (options.fetcher ?? fetch)(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(options.timeoutMs ?? 30000), redirect: "error" });
    } catch { throw new KieError("连接 KIE 超时或网络不可用（未自动重发同一付费请求）", 500, true); }
    const data = response.ok && response.headers.get("content-type")?.includes("text/event-stream") ? await readKieStream(response, options.onDelta) : await response.json().catch(() => null);
    const hasCode = data !== null && Object.prototype.hasOwnProperty.call(data, "code");
    const bodyCode = hasCode ? data.code === null || data.code === '' ? 502 : Number(data.code) : options.allowMissingCode ? 200 : 502;
    const code = response.status === 429 ? 429 : !response.ok ? response.status : Number.isFinite(bodyCode) ? bodyCode : 502;
    if (code === 429 && attempt < attempts - 1) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await (options.sleep ?? delay)(Math.min(30000, Math.max(1000 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0)));
      continue;
    }
    if (code !== 200 || !data) { const failure = kieFailure(code, safeKieMessage(data?.msg, key)); failure.cost = kieCreditCost(data?.credits_consumed ?? data?.data?.creditsConsumed); if (failure instanceof KieError) failure.businessFailure = response.ok && hasCode; throw failure; }
    return data;
  }
  throw kieFailure(429);
}

// Responses SSE 的最终完成事件包含工具调用、用量和积分；只在完整结束后执行工具。
export async function readKieStream(response: Response, onDelta?: (text: string) => void) {
  if (!response.body) throw new KieError("模型流式响应为空", 502, true);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = "";
  let completed: Record<string, unknown> | undefined; let consumed: number | undefined;
  try {
    for (;;) {
      const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done }).replace(/\r\n/g, "\n");
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const raw = event.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n");
        if (!raw || raw === "[DONE]") continue;
        const data = JSON.parse(raw);
        if (typeof data.credits_consumed === "number") consumed = data.credits_consumed;
        if (typeof data.response?.credits_consumed === "number") consumed = data.response.credits_consumed;
        if (data.type === "response.output_text.delta" && typeof data.delta === "string") onDelta?.(data.delta);
        if (data.type === "response.completed") { completed = data.response; if (completed) { await reader.cancel().catch(() => undefined); return consumed === undefined ? completed : { ...completed, credits_consumed: consumed }; } }
        if (["response.failed", "response.incomplete", "error"].includes(data.type)) throw kieFailure(502, data.error?.message ?? data.response?.error?.message);
      }
      if (chunk.done) break;
    }
  } catch (error) { if (error instanceof GatewayError) throw error; throw new KieError("模型流式响应中断；已保留调用记录，请核对成本后重试", 502, true); }
  finally { reader.releaseLock(); }
  if (!completed) throw new KieError("模型流式响应未完成；没有执行工具", 502, true);
  return consumed === undefined ? completed : { ...completed, credits_consumed: consumed };
}
