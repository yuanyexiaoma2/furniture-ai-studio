"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Pencil, X, LoaderCircle } from "@/components/icons/concept-icons";
import { Button } from "@/components/ui/button";
import { GenerationOptions, generationBlockReason } from "@/components/generation-options";
import { modelLabel, sceneAspectRatios, type SceneResolution, type SceneAspectRatio } from "@/lib/models.config";
import type { ProductSnapshot } from "@/lib/product-data";
import type { GenerationAvailability } from "@/lib/scene-generation";

export function ImageEditPanel({ source, product, availability, readonly, onClose, onQueued }: { source: ProductSnapshot["jobs"][number]; product: ProductSnapshot; availability: GenerationAvailability; readonly: boolean; onClose: () => void; onQueued: () => Promise<void> }) {
  const panel = useRef<HTMLElement>(null);
  const instruction = useRef<HTMLTextAreaElement>(null);
  const [resolution, setResolution] = useState<SceneResolution>("1K");
  const [aspectRatio, setAspectRatio] = useState<SceneAspectRatio>(sceneAspectRatios.includes(source.aspectRatio as SceneAspectRatio) ? source.aspectRatio as SceneAspectRatio : "1:1");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const usd = availability.estimates[resolution];
  const blocked = generationBlockReason(product, availability, readonly, usd);
  useEffect(() => { panel.current?.scrollIntoView({ behavior: "smooth", block: "center" }); instruction.current?.focus({ preventScroll: true }); }, []);
  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      let response: Response;
      try { response = await fetch(`/api/products/${product.id}/edits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceJobId: source.id, sourceAssetId: source.resultAssetIds[0], editIntent: form.get("editIntent"), aspectRatio, resolution }) }); }
      catch { throw new Error("提交结果未确认，请先刷新生成记录，核对后再重试"); }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "编辑任务创建失败");
      setNotice("编辑任务已加入队列，原图保留，新版本会出现在生成记录中。");
      try { await onQueued(); } catch { setNotice("编辑任务已提交，请刷新生成记录查看新版本。"); }
    } catch (error) { setError(error instanceof Error ? error.message : "编辑提交失败"); }
    finally { setPending(false); }
  }
  return <section ref={panel} className="workspace-panel edit-panel" aria-label="二次编辑面板"><div className="panel-heading"><h2><Pencil size="sm" />二次编辑</h2><Button variant="ghost" size="icon" aria-label="关闭二次编辑" onClick={onClose} disabled={pending}><X size="md" /></Button></div><form className="scene-form" onSubmit={edit}>
    <div className="edit-source"><Image src={`/api/assets/${source.resultAssetIds[0]}`} width={96} height={96} unoptimized alt="二次编辑原图" /><div><strong>在这张图的基础上修改</strong><p>选中原图与当前实拍共同作为参考，锁定产品身份；原图保留，编辑后新增版本。</p></div></div>
    <label htmlFor="edit-intent">这张图需要怎样修改？</label><textarea ref={instruction} id="edit-intent" name="editIntent" required maxLength={8000} rows={4} placeholder="例如：保留产品和现有构图，将墙面改为暖白色，去掉右侧落地灯，减弱窗边光线。" disabled={readonly || pending} />
    <GenerationOptions prefix="edit" resolution={resolution} aspectRatio={aspectRatio} disabled={readonly || pending} onResolution={setResolution} onAspectRatio={setAspectRatio} />
    <div className="generation-spec"><span>{modelLabel()} · {resolution} · PNG</span><strong>预估 ${usd.toFixed(6)} 起</strong></div><div className="scene-action"><Button type="submit" disabled={pending || Boolean(blocked)}>{pending ? <LoaderCircle size="sm" className="animate-spin" /> : <Pencil size="sm" />}生成编辑版本</Button><span>本月剩余 ${availability.remaining.toFixed(6)}</span></div>{blocked && <p className="field-hint">{blocked}</p>}<p role={error ? "alert" : "status"} className={error ? "form-notice error-notice" : "form-notice"}>{error || notice}</p>
  </form></section>;
}
