"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowUpRight, LoaderCircle, Sparkles, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductEditor } from "@/components/product-editor";
import { models, modelCost, sceneAspectRatios } from "@/lib/models.config";
import type { ProductSnapshot } from "@/lib/product-data";
import type { GenerationAvailability } from "@/lib/scene-generation";

const statuses = { pending: "等待提交", running: "生成与转存中", success: "生成完成", failed: "生成失败", cancelled: "已取消" };
function elapsed(job: ProductSnapshot["jobs"][number]) {
  if (!job.completedAt) return "进行中";
  return `${Math.max(0, Math.round((Date.parse(job.completedAt) - Date.parse(job.createdAt)) / 1000))} 秒`;
}

export function ProductStudio({ initial, initialAvailability, readonly }: { initial: ProductSnapshot; initialAvailability: GenerationAvailability; readonly: boolean }) {
  const [product, setProduct] = useState(initial);
  const [availability, setAvailability] = useState(initialAvailability);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/products/${initial.id}/generations`, { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "读取生成记录失败");
    setProduct(result.product); setAvailability(result.availability); setRefreshError("");
  }, [initial.id]);
  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    const poll = async () => {
      if (refreshing) return;
      refreshing = true;
      try { await refresh(controller.signal); }
      catch { if (!controller.signal.aborted) setRefreshError("记录更新暂时失败，请检查连接后刷新；已提交的任务会继续执行。"); }
      finally { refreshing = false; }
    };
    const timer = setInterval(() => void poll(), 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);
  const { credits, usd } = modelCost("scene-main");
  const unavailable = readonly ? "只读成员可以查看生成记录" : !availability.configured ? "请管理员配置 KIE 密钥" : !availability.workerReady ? "生图服务离线，请启动 worker" : product.photos.length < 2 ? "请先上传至少 2 张实拍图" : !product.identityTraits.trim() ? "请先保存产品身份特征" : availability.remaining < credits ? "本月剩余积分不足，请联系管理员" : "";
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      let response: Response;
      try {
        response = await fetch(`/api/products/${product.id}/generations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sceneIntent: form.get("sceneIntent"), aspectRatio: form.get("aspectRatio") }) });
      } catch { throw new Error("提交结果未确认，请先刷新生成记录，核对任务后再重试"); }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "任务创建失败");
      setNotice("任务已加入队列，生成完成后自动保存；可以离开页面，稍后回来查看。");
      try { await refresh(); } catch { setRefreshError("任务已提交，记录更新暂时失败，请刷新查看。"); }
    } catch (error) { setError(error instanceof Error ? error.message : "任务创建失败"); }
    finally { setPending(false); }
  }
  return <>
    <ProductEditor product={initial} readonly={readonly} onUpdate={setProduct}>
      <section className="workspace-panel scene-panel">
        <div className="panel-heading"><h2>03 / 场景创作</h2><Sparkles size={17} aria-hidden="true" /></div>
        <form className="scene-form" onSubmit={generate}>
          <label htmlFor="scene-intent">想把产品放进怎样的空间？</label>
          <textarea id="scene-intent" name="sceneIntent" placeholder="例如：温暖自然的北欧客厅，以浅色墙面与原木家具营造日常居家的氛围。" required maxLength={8000} rows={4} disabled={readonly || pending} />
          <p className="field-hint">自动使用已保存的产品身份特征和全部实拍参考。修改资料后请先保存。</p>
          <fieldset className="aspect-options" disabled={readonly || pending}><legend>画面比例</legend>{sceneAspectRatios.map((ratio) => <label key={ratio}><input type="radio" name="aspectRatio" value={ratio} defaultChecked={ratio === "1:1"} /><span>{ratio}</span></label>)}</fieldset>
          <div className="generation-spec"><span>{models["scene-main"].label} · 2K · PNG</span><strong>{credits} 积分 <small>约 ${usd.toFixed(2)}</small></strong></div>
          <div className="scene-action"><Button type="submit" disabled={pending || Boolean(unavailable)}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}生成一张场景图</Button><span>本月剩余 {availability.remaining} / {availability.quota} 积分</span></div>
          {unavailable && <p className="field-hint">{unavailable}</p>}
          <p className={error ? "form-notice error-notice" : "form-notice"} role={error ? "alert" : "status"}>{error || notice}</p>
        </form>
      </section>
    </ProductEditor>
    <section className="workspace-panel generation-history">
      <div className="panel-heading"><h2>04 / 生成记录 <span className="history-count">{product.jobs.length}</span></h2><Button variant="ghost" size="sm" onClick={() => void refresh().catch(() => setRefreshError("读取记录失败，请稍后重试"))}><RefreshCw size={14} />刷新记录</Button></div>
      {refreshError && <p role="alert" className="history-warning">{refreshError}</p>}
      {!product.jobs.length ? <div className="history-empty"><Sparkles size={25} /><p>第一张场景图，从一个空间想法开始。</p><span>生成记录自动保存，刷新或重新登录后仍可查看。</span></div> : <div className="generation-grid">{product.jobs.map((job) => <article key={job.id} className="generation-card" data-testid={`generation-${job.id}`}>
        <div className="generation-preview">{job.resultAssetIds[0] ? <a href={`/api/assets/${job.resultAssetIds[0]}`} target="_blank" rel="noreferrer"><Image src={`/api/assets/${job.resultAssetIds[0]}`} width={640} height={640} unoptimized alt="生成场景图预览" /></a> : <div className="generation-placeholder">{["pending", "running"].includes(job.status) ? <LoaderCircle size={26} className="animate-spin" /> : <Sparkles size={26} />}<p>{statuses[job.status]}</p></div>}<span className={`job-status job-${job.status}`}>{statuses[job.status]}</span></div>
        <div className="generation-details"><p className="generation-intent">{job.sceneIntent || "场景创作"}</p><p>{job.model} · {job.provider} · {job.resolution} · {job.aspectRatio}</p><p>{new Date(job.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} · {elapsed(job)} · {job.cost} 积分</p>{job.taskId && <p className="job-task">任务编号：{job.taskId}</p>}{job.error && <p className="job-error">{job.error}</p>}{job.resultAssetIds[0] && <a className="generation-download" href={`/api/assets/${job.resultAssetIds[0]}?download=1`}><Download size={14} />下载候选图</a>}</div>
      </article>)}</div>}
      <p className="history-footnote">生成图为候选图，需美工确认后作为终稿使用。提交前预留积分；扣费状态不确定时保留预留，需核对账户记录。</p>
    </section>
  </>;
}
