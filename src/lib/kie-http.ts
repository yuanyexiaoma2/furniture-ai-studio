import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { db } from "@/lib/db";
import { GatewayError, safeGatewayMessage } from "@/lib/gateway-error";

export class KieError extends GatewayError {
  constructor(message: string, public code: number = 500, uncertain = false) { super("kie", message, code, code === 429 || code >= 500, uncertain); }
}

export function safeKieMessage(message: unknown, key = process.env.KIE_API_KEY || "") {
  let text = typeof message === "string" ? message : "未知错误";
  if (key) text = text.split(key).join("[密钥已隐藏]");
  return safeGatewayMessage(text).slice(0, 300);
}

export function kieFailure(code: number, detail?: unknown) {
  if (code === 401 || code === 403) return new KieError("KIE 密钥无效或无访问权限，请检查 KIE_API_KEY 后重新生成", code);
  if (code === 402) return new KieError("KIE 账户积分不足，请充值后重新生成", code);
  if (code === 429) return new KieError("KIE 请求过于频繁，退避重试后仍未成功，请稍后重新生成", code);
  if (code === 422 || code === 400) return new KieError(`KIE 参数或任务无效：${safeKieMessage(detail)}`, code);
  return new KieError(`KIE 服务请求失败（${code}）：${safeKieMessage(detail)}`, code);
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

type Options = { key?: string; fetcher?: typeof fetch; beforeRequest?: () => Promise<void>; sleep?: (ms: number) => Promise<unknown>; allowMissingCode?: boolean; timeoutMs?: number };
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
    const data = await response.json().catch(() => null);
    const code = response.status === 429 ? 429 : !response.ok ? response.status : Number(data?.code ?? (options.allowMissingCode ? 200 : 500));
    if (code === 429 && attempt < attempts - 1) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await (options.sleep ?? delay)(Math.min(30000, Math.max(1000 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0)));
      continue;
    }
    if (code !== 200 || !data) throw kieFailure(code, safeKieMessage(data?.msg, key));
    return data;
  }
  throw kieFailure(429);
}
