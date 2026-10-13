import { roundUsd } from "./gateway-cost";
// used 包含已消耗和进行中预留，二者由同一月度账本查询汇总。
export function quotaShortage(quota: number, used: number, estimate: number) { return roundUsd(Math.max(0, used + estimate - quota)); }
