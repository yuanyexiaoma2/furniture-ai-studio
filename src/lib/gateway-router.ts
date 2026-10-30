import { GatewayError, gatewayException, switchableGatewayFailure, type GatewayName } from "./gateway-error";
import {imageRouteCandidates} from "./image-models";
import { models, type LogicalModel, type ModelCandidate } from "./models.config";

export type CircuitState = { consecutiveFailures: number; windowStartedAt: number | null; openUntil: number | null };
export const emptyCircuit = (): CircuitState => ({ consecutiveFailures: 0, windowStartedAt: null, openUntil: null });
export function circuitFailure(state: CircuitState, now: number): CircuitState {
  const recent = state.windowStartedAt !== null && now - state.windowStartedAt < 5 * 60_000;
  const count = recent ? state.consecutiveFailures + 1 : 1;
  return { consecutiveFailures: count, windowStartedAt: recent ? state.windowStartedAt : now, openUntil: count >= 3 ? now + 3 * 60_000 : null };
}
export interface CircuitStore { isOpen(provider: GatewayName): Promise<boolean>; success(provider: GatewayName): Promise<void>; failure(provider: GatewayName): Promise<void> }
export function gatewayPreference() { const value = process.env.GATEWAY_PREFERENCE; return value === "kie" || value === "zenmux" ? value : "auto"; }
export function candidatesFor(logical: LogicalModel, preference = gatewayPreference()): readonly ModelCandidate[] {
  if(logical==="llm-agent"||logical==="llm-vision")return models[logical].filter(c=>c.provider==="zenmux");
  void preference;return imageRouteCandidates(models[logical][0]);
}
export function gatewayConfigured(provider: GatewayName) { return Boolean(process.env[provider === "kie" ? "KIE_API_KEY" : "ZENMUX_API_KEY"]?.trim()); }
export type RouteHooks<T> = {
  start(candidate: ModelCandidate, fallback: boolean): Promise<string>;
  success(id: string, result: T, duration: number): Promise<void>;
  failure(id: string, error: GatewayError, duration: number): Promise<void>;
};
export async function routeCall<T>(options: {
  logical: LogicalModel; circuit: CircuitStore; call(candidate: ModelCandidate): Promise<T>;
  hooks: RouteHooks<T>; configured?: typeof gatewayConfigured; candidates?: readonly ModelCandidate[];
  excluded?: string[]; alreadyFallback?: boolean; now?: () => number; probe?: boolean; isSuccessful?: (result: T) => boolean; previousErrors?: string[]; previousProvider?: GatewayName;
}) {
  const now = options.now ?? Date.now;
  const failures: string[] = [...(options.previousErrors ?? [])];
  let lastProvider: GatewayName = options.previousProvider ?? "kie";
  let fallback = options.alreadyFallback ?? false;
  // 汇总保留扣费不确定标记；图片仅允许按同款映射切换一次，原请求仍保留审计。
  let uncertain = false;
  const list=options.candidates??candidatesFor(options.logical);
  for (const candidate of list.filter(c=>options.logical.startsWith("llm-")?c.provider==="zenmux":true)) {
    if (!candidate.model || !(options.configured ?? gatewayConfigured)(candidate.provider) || options.excluded?.includes(`${candidate.provider}:${candidate.model}`)) continue;
    lastProvider = candidate.provider;
    if (!options.probe && await options.circuit.isOpen(candidate.provider)) { failures.push(`${candidate.provider === "kie" ? "KIE" : "ZenMux"} 已熔断`); fallback = true; continue; }
    const id = await options.hooks.start(candidate, fallback);
    const start = now();
    let result: T;
    try { result = await options.call(candidate); }
    catch (error) {
      const failure = gatewayException(candidate.provider, error);
      uncertain ||= failure.uncertain;
      await options.hooks.failure(id, failure, now() - start);
      await options.circuit.failure(candidate.provider);
      failures.push(failure.message);
      if (!switchableGatewayFailure(failure)) throw new GatewayError(candidate.provider, `${failure.message}；该错误未自动切换${fallback ? '（本次已尝试备用线路）' : ''}`, failure.status, false, uncertain);
      fallback = true; continue;
    }
    // 本地保存 / 记录失败不能再次发起付费生成。
    await options.hooks.success(id, result, now() - start);
    if (!options.isSuccessful || options.isSuccessful(result)) await options.circuit.success(candidate.provider);
    return { result, candidate, fallback, attemptId: id, warnings: failures };
  }
  throw new GatewayError(lastProvider, failures.length ? `${failures.join('；')}；已检查可用备用线路，仍未成功，请稍后重试` : "没有可用网关，请配置 API Key 后重启服务", 503, true, uncertain);
}
