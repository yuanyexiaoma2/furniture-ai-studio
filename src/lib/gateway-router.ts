import { GatewayError, gatewayException, type GatewayName } from "./gateway-error";
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
  return [...models[logical]].sort((a, b) => Number(b.provider === preference) - Number(a.provider === preference));
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
  excluded?: string[]; alreadyFallback?: boolean; now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const failures: string[] = [];
  let fallback = options.alreadyFallback ?? false;
  for (const candidate of options.candidates ?? candidatesFor(options.logical)) {
    if (!candidate.model || !(options.configured ?? gatewayConfigured)(candidate.provider) || options.excluded?.includes(`${candidate.provider}:${candidate.model}`)) continue;
    if (await options.circuit.isOpen(candidate.provider)) { failures.push(`${candidate.provider === "kie" ? "KIE" : "ZenMux"} 已熔断`); fallback = true; continue; }
    const id = await options.hooks.start(candidate, fallback);
    const start = now();
    let result: T;
    try { result = await options.call(candidate); }
    catch (error) {
      const failure = gatewayException(candidate.provider, error);
      await options.hooks.failure(id, failure, now() - start);
      await options.circuit.failure(candidate.provider);
      failures.push(failure.message);
      if (!failure.retryable) throw new GatewayError(candidate.provider, `${failure.message}；参数或权限错误，未自动切换${fallback ? '（本次已尝试备用线路）' : ''}`, failure.status, false, failure.uncertain);
      fallback = true; continue;
    }
    // 本地保存 / 记录失败不能再次发起付费生成。
    await options.hooks.success(id, result, now() - start);
    await options.circuit.success(candidate.provider);
    return { result, candidate, fallback, attemptId: id };
  }
  throw new GatewayError("kie", failures.length ? `${failures.join('；')}；已自动尝试可用备用线路，仍未成功，请稍后重试` : "没有可用网关，请配置 API Key 后重启服务", 503, true);
}
