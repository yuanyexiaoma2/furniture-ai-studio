"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Radio, LoaderCircle } from "@/components/icons/concept-icons";
import { Button } from "@/components/ui/button";
import type { GatewayStatus } from "@/lib/gateway-status";
type Provider = "kie" | "zenmux";
export function GatewayManager({ initial }: { initial: GatewayStatus }) {
  const [data, setData] = useState(initial), [pending, setPending] = useState("");
  const [confirmation, setConfirmation] = useState<{ provider: Provider; kind: "llm" | "image" } | null>(null);
  const [notice, setNotice] = useState(""), [error, setError] = useState("");
  async function refresh() { const reply = await fetch("/api/admin/gateways", { cache: "no-store" }); const result = await reply.json(); if (!reply.ok) throw new Error(result.error); setData(result); }
  useEffect(() => { const timer = setInterval(() => void refresh().catch(() => {}), 5000); return () => clearInterval(timer); }, []);
  async function test() {
    if (!confirmation) return;
    const input = confirmation; setConfirmation(null); setPending(`${input.provider}:${input.kind}`); setNotice(""); setError("");
    try { const reply = await fetch("/api/admin/gateways/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, confirmed: true }) }); const result = await reply.json(); if (!reply.ok) throw new Error(result.error); setNotice(`${input.provider === "kie" ? "KIE" : "ZenMux"}：${result.message}${result.jobId ? ` 任务 ${result.jobId}` : ''}`); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "测试失败，请检查网络"); }
    finally { setPending(""); }
  }
  return <>
    <div className="page-intro"><div><p className="eyebrow">AI 服务管理</p><h1>网关状态<span className="title-dot">.</span></h1><p className="intro-copy">查看近 24 小时调用表现与费用，验证备用线路是否可用。</p></div><Button variant="outline" onClick={() => void refresh().catch(() => setError("状态更新失败，请稍后重试"))}><RefreshCw size={15} />刷新状态</Button></div>
    <div className="gateway-grid">{data.gateways.map(gateway => <section className="workspace-panel gateway-card" key={gateway.provider}>
      <div className="panel-heading"><h2><Radio size={18} />{gateway.provider === "kie" ? "KIE" : "ZenMux"}</h2><span className={`gateway-badge ${gateway.configured && !gateway.open ? 'healthy' : ''}`}>{!gateway.configured ? "未配置" : gateway.open ? "已熔断" : "正常"}</span></div>
      <p className="field-hint">{gateway.provider === "kie" ? "原始积分换算为美元 · 异步生图" : "美元计费 · 同步生图"} · {gateway.configured ? "已配置密钥" : "填写服务端密钥并重启后启用"}</p>
      {gateway.open && <p className="history-warning">暂停至 {new Date(gateway.openUntil!).toLocaleTimeString("zh-CN")}，期间自动使用下一候选线路。</p>}
      <div className="gateway-stats"><div><strong>{gateway.calls}</strong><span>近 24 小时调用</span></div><div><strong>{gateway.successRate === null ? '—' : `${gateway.successRate}%`}</strong><span>已结束调用成功率</span></div><div><strong>{gateway.averageMs === null ? '—' : `${(gateway.averageMs / 1000).toFixed(1)} s`}</strong><span>平均耗时</span></div></div>
      <div className="gateway-cost"><span>费用合计（美元）</span><strong>{gateway.totals.USD ? `$${gateway.totals.USD.amount.toFixed(6)}` : "—"}</strong><small>实际 ${(gateway.totals.USD ? gateway.totals.USD.amount - gateway.totals.USD.estimated : 0).toFixed(6)} · 预估 ${(gateway.totals.USD?.estimated ?? 0).toFixed(6)} · 原始 KIE 积分 {gateway.rawCredits}</small><small>生图 {gateway.imageCalls} 次 · LLM {gateway.llmCalls} 次 · 进行中 {gateway.active} 次 · 待账单回填 {gateway.pendingBills} 次 · 保留预估 {gateway.unresolvedBills} 次</small></div>
      {gateway.lastError && <p className="job-error">最近失败：{gateway.lastError}</p>}
      <div className="gateway-actions">{(["llm", "image"] as const).map(kind => <Button variant="outline" key={kind} disabled={!gateway.configured || Boolean(pending)} onClick={() => setConfirmation({ provider: gateway.provider, kind })}>{pending === `${gateway.provider}:${kind}` && <LoaderCircle className="animate-spin" size={15} />}{kind === "llm" ? "连通性测试 · LLM" : "连通性测试 · 1K 生图"}</Button>)}</div>
    </section>)}</div>
    <p className={error ? "form-notice error-notice" : "form-notice"} role={error ? "alert" : "status"}>{error || notice}</p>
    <section className="workspace-panel gateway-routes"><div className="panel-heading"><h2>逻辑模型路由</h2><span className="gateway-badge">GATEWAY_PREFERENCE = {data.preference}</span></div><p className="field-hint">按顺序选择，自动跳过未配置网关；实际失败或熔断后改用的线路标记“备用线路”。配置只读，修改环境变量后重启服务。</p>
      <div className="gateway-route-list">{data.routes.map(route => <div key={route.logical}><strong>{route.logical}</strong><ol>{route.candidates.map(candidate => <li key={candidate.provider}><span>{candidate.provider}</span><code>{candidate.model}</code><small>{candidate.supportsTools ? '支持工具调用' : '不用于工具调用'}</small></li>)}</ol></div>)}</div>
      <p className="field-hint">“正常”表示密钥已配置且未熔断，不代表已经实测。费用与配额统一美元；KIE 原始积分另存，ZenMux 账单有延迟，暂时显示预估。</p>
    </section>
    {confirmation && <div className="gateway-dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="gateway-confirm-title" className="workspace-panel gateway-dialog"><h2 id="gateway-confirm-title">确认付费连通性测试</h2><p>将向 {confirmation.provider === 'kie' ? 'KIE' : 'ZenMux'} {confirmation.kind === 'image' ? '提交一张 1K 图片' : '发送一句简短问候'}。这会产生真实网关费用，并占用美元月度配额{confirmation.provider === 'kie' && confirmation.kind === 'image' ? '，预估 $0.020（原始 4 积分）' : '，实付以网关账单为准'}。</p><div className="gateway-actions"><Button variant="outline" onClick={() => setConfirmation(null)}>取消</Button><Button onClick={() => void test()}>确认并测试</Button></div></section></div>}
  </>;
}
