"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import {ArrowUpRight,LoaderCircle,Sparkles,RefreshCw,Download,Pencil} from "@/components/icons/concept-icons";
import { Button } from "@/components/ui/button";
import { ProductEditor } from "@/components/product-editor";
import { modelLabel, type SceneResolution, type SceneAspectRatio } from "@/lib/models.config";
import { GenerationOptions } from "@/components/generation-options";
import { ImageEditPanel } from "@/components/image-edit-panel";
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
  const [resolution, setResolution] = useState<SceneResolution>("1K");
  const [aspectRatio, setAspectRatio] = useState<SceneAspectRatio>("1:1");
  const [editSource, setEditSource] = useState<ProductSnapshot["jobs"][number] | null>(null);
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
  const usd = availability.estimates[resolution];
  const unavailable = readonly?"只读成员不能规划生成":!product.photos.length?"请先上传产品实拍":!product.identityTraits?.trim()?"请先保存产品身份特征":"";
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      let response: Response;
      try {
        response = await fetch(`/api/products/${product.id}/generations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sceneIntent: form.get("sceneIntent"), aspectRatio, resolution }) });
      } catch { throw new Error("提交结果未确认，请先刷新生成记录，核对任务后再重试"); }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "任务创建失败");
      if(result.workspaceUrl){window.location.assign(result.workspaceUrl);return;}
      setNotice("视觉方案已准备好，请前往工作台确认后生成。");
      try { await refresh(); } catch { setRefreshError("任务已提交，记录更新暂时失败，请刷新查看。"); }
    } catch (error) { setError(error instanceof Error ? error.message : "任务创建失败"); }
    finally { setPending(false); }
  }
  return <>
    <ProductEditor product={product} readonly={readonly} onUpdate={setProduct}>
      <section className="workspace-panel scene-panel">
        <div className="panel-heading"><h2>03 / 场景创作</h2><Sparkles size="sm" aria-hidden="true" /></div>
        <form className="scene-form" onSubmit={generate}>
          <label htmlFor="scene-intent">想把产品放进怎样的空间？</label>
          <textarea id="scene-intent" name="sceneIntent" placeholder="例如：温暖自然的北欧客厅，以浅色墙面与原木家具营造日常居家的氛围。" required maxLength={8000} rows={4} disabled={readonly || pending} />
          <p className="field-hint">自动使用已保存的产品身份特征和全部实拍参考。修改资料后请先保存。</p>
          <GenerationOptions prefix="scene" resolution={resolution} aspectRatio={aspectRatio} disabled={readonly || pending} onResolution={setResolution} onAspectRatio={setAspectRatio} />
          <div className="generation-spec"><span>{modelLabel()} · {resolution} · PNG</span><strong>预估 ${usd.toFixed(6)} 起 <small>提交时按参考图与实际线路校验</small></strong></div>
          <div className="scene-action"><Button type="submit" disabled={pending || Boolean(unavailable)}>{pending ? <LoaderCircle size="sm" className="animate-spin" /> : <ArrowUpRight size="sm" />}规划一张场景图</Button><span>本月剩余 ${availability.remaining.toFixed(6)} / ${availability.quota.toFixed(6)}</span></div>
          {unavailable && <p className="field-hint">{unavailable}</p>}
          <p className={error ? "form-notice error-notice" : "form-notice"} role={error ? "alert" : "status"}>{error || notice}</p>
        </form>
      </section>
      {editSource && <ImageEditPanel key={editSource.id} source={editSource} product={product} availability={availability} readonly={readonly} onClose={() => setEditSource(null)} onQueued={refresh} />}
    </ProductEditor>
    <section className="workspace-panel generation-history">
      <div className="panel-heading"><h2>04 / 生成记录 <span className="history-count">{product.jobs.length}</span></h2><Button variant="ghost" size="sm" onClick={() => void refresh().catch(() => setRefreshError("读取记录失败，请稍后重试"))}><RefreshCw size="sm" />刷新记录</Button></div>
      {refreshError && <p role="alert" className="history-warning">{refreshError}</p>}
      {!product.jobs.length ? <div className="history-empty"><Sparkles size="md" /><p>第一张场景图，从一个空间想法开始。</p><span>生成记录自动保存，刷新或重新登录后仍可查看。</span></div> : <div className="generation-grid">{product.jobs.map((job) => <article key={job.id} className="generation-card" data-testid={`generation-${job.id}`}>
        <div className="generation-preview">{job.resultAssetIds[0] ? <a href={`/api/assets/${job.resultAssetIds[0]}`} target="_blank" rel="noreferrer"><Image src={`/api/assets/${job.resultAssetIds[0]}`} width={640} height={640} unoptimized alt="生成场景图预览" /></a> : <div className="generation-placeholder">{["pending", "running"].includes(job.status) ? <LoaderCircle size="md" className="animate-spin" /> : <Sparkles size="md" />}<p>{statuses[job.status]}</p></div>}<span className={`job-status job-${job.status}`}>{statuses[job.status]}</span></div>
        <div className="generation-details">{job.logicalModel === "edit" && <p className="edit-version-label">二次编辑版本{job.sourceAssetId && <> · <a href={`/api/assets/${job.sourceAssetId}`} target="_blank" rel="noreferrer">查看原图</a></>}</p>}<p className="generation-intent">{job.editIntent || job.sceneIntent || "场景创作"}</p><p>{job.fallback && <strong className="fallback-label">备用线路 · </strong>}{job.model} · {job.provider} · {job.resolution} · {job.aspectRatio === "auto" ? "自动" : job.aspectRatio}</p><p>{new Date(job.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} · {elapsed(job)} · {job.costUsd === null ? `费用待确认（美元预留 $${job.reservedUsd.toFixed(6)}）` : `${job.costEstimated ? "预估" : "实际"} $${job.costUsd.toFixed(6)}`}{job.credits !== null && `（原始 ${job.credits} KIE 积分）`}</p>{job.resultImages.map(image => <div key={image.id}><p>实际像素：{image.width} × {image.height} px</p>{Math.max(image.width, image.height) < 2000 && <p className="resolution-warning">分辨率不足亚马逊建议值</p>}</div>)}{job.identityTraits && <details className="identity-snapshot"><summary>本次使用的身份特征版本</summary><p>{job.identityVersionId || "历史快照"}{job.identitySavedAt && ` · ${new Date(job.identitySavedAt).toLocaleString("zh-CN")}`}</p><p>{job.identityTraits}</p></details>}{job.taskId && <p className="job-task">任务编号：{job.taskId}</p>}{job.error && <p className="job-error">{job.error}</p>}{job.resultAssetIds[0] && <div className="generation-card-actions"><a className="generation-download" href={`/api/assets/${job.resultAssetIds[0]}?download=1`}><Download size="sm" />下载候选图</a>{job.status === "success" && !readonly && <Button variant="outline" size="sm" onClick={() => setEditSource(job)}><Pencil size="sm" />二次编辑</Button>}</div>}</div>
      </article>)}</div>}
      <p className="history-footnote">生成图为候选图，需美工确认后作为终稿使用。费用和配额统一美元；预估会在获得实际消耗后更新，扣费不确定时请核对账单。</p>
    </section>
  </>;
}
