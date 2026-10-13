"use client";
import { useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { Upload, LoaderCircle, Trash2, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductSnapshot } from "@/lib/product-data";

export function PhotoManager({ product, readonly, onUpdate }: { product: ProductSnapshot; readonly: boolean; onUpdate: (product: ProductSnapshot) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const dragged = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [target, setTarget] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const photos = order ? order.flatMap((id) => product.photos.filter((photo) => photo.id === id)) : product.photos;
  async function update() {
    const response = await fetch(`/api/products/${product.id}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.product) throw new Error("操作已保存，列表更新失败，请刷新页面查看");
    onUpdate(result.product);
  }
  async function perform(operation: () => Promise<void>, success: string) {
    if (readonly || busy.current) return;
    busy.current = true; setPending(true); setError(""); setNotice("");
    try { await operation(); await update(); setNotice(success); }
    catch (error) { setError(error instanceof Error ? error.message : "操作失败，请刷新后重试"); }
    finally { busy.current = false; setPending(false); setOrder(null); }
  }
  async function send(url: string, init: RequestInit) {
    const response = await fetch(url, init);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "图片操作失败");
  }
  async function upload(files: File[]) {
    if (!files.length || readonly || busy.current) return;
    if (files.length + product.photos.length > 3) { setError("每件商品最多保存 3 张实拍参考图，请先删除不需要的图片"); return; }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 30 * 1024 * 1024)) { setError("请拖入有效的 JPEG、PNG 或 WEBP 图片，单张不超过 30MB"); return; }
    const form = new FormData(); files.forEach((file) => form.append("photos", file));
    await perform(() => send(`/api/products/${product.id}/photos`, { method: "POST", body: form }), "实拍图已保存，可继续填写场景意图");
    if (input.current) input.current.value = "";
  }
  function reorder(from: number, to: number) {
    if (readonly || busy.current || from === to || from < 0 || to < 0 || to >= photos.length) return;
    const next = photos.map((photo) => photo.id);
    const [id] = next.splice(from, 1); next.splice(to, 0, id);
    setOrder(next);
    void perform(() => send(`/api/products/${product.id}/photos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoIds: next }) }), "参考图顺序已保存");
  }
  function fileDrop(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault(); event.stopPropagation(); setDragOver(false);
    void upload(Array.from(event.dataTransfer.files));
  }
  return <section className={`workspace-panel photo-panel${dragOver ? " photo-drop-active" : ""}`} onDragOver={(event) => { if (!readonly && !pending && event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragOver(true); } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false); }} onDrop={fileDrop}>
    <div className="panel-heading"><h2>02 / 实拍参考</h2><span className="count-chip">{product.photos.length} / 3</span></div>
    <div className="reference-content"><p className="field-hint">同一件产品的 2～3 张不同角度实拍。JPEG / PNG / WEBP，单张 ≤30MB。图片顺序会用于后续生成。</p>
      <div className="reference-grid">{photos.map((photo, index) => <figure key={photo.id} className={`reference-card${target === photo.id ? " reference-drag-target" : ""}`} data-testid={`reference-${photo.id}`} draggable={!readonly && !pending} onDragStart={(event) => { dragged.current = photo.id; event.dataTransfer.setData("text/plain", photo.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { dragged.current = null; setTarget(""); }} onDragOver={(event) => { if (!readonly && !pending && dragged.current && !event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setTarget(photo.id); } }} onDrop={(event) => { if (event.dataTransfer.types.includes("Files")) return; if (!dragged.current) return; event.preventDefault(); event.stopPropagation(); reorder(photos.findIndex((entry) => entry.id === dragged.current), index); dragged.current = null; setTarget(""); }}>
        <Image src={`/api/assets/${photo.id}`} alt={`产品实拍图 ${index + 1}`} width={photo.width} height={photo.height} unoptimized draggable={false} />
        {!readonly && <button type="button" className="reference-delete" aria-label={`删除参考 ${index + 1}`} title="删除此实拍参考" disabled={pending} onClick={() => void perform(() => send(`/api/products/${product.id}/photos/${photo.id}`, { method: "DELETE" }), "实拍图已删除，历史生成记录保留")}><Trash2 size={14} /></button>}
        <figcaption>{!readonly && <GripVertical size={13} aria-hidden="true" />}参考 {String(index + 1).padStart(2, "0")}</figcaption>
        {!readonly && <div className="reference-move"><Button variant="ghost" size="icon" aria-label={`向前移动参考 ${index + 1}`} disabled={pending || index === 0} onClick={() => reorder(index, index - 1)}><ChevronLeft size={14} /></Button><Button variant="ghost" size="icon" aria-label={`向后移动参考 ${index + 1}`} disabled={pending || index === photos.length - 1} onClick={() => reorder(index, index + 1)}><ChevronRight size={14} /></Button></div>}
      </figure>)}</div>
      {!readonly && <><label htmlFor="photos" className="sr-only">实拍参考图</label><input ref={input} id="photos" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={pending} onChange={(event) => void upload(Array.from(event.target.files ?? []))} /><button type="button" className="photo-dropzone" disabled={pending || product.photos.length >= 3} onClick={() => input.current?.click()}>{pending ? <LoaderCircle size={22} className="animate-spin" /> : <Upload size={22} />}<strong>{pending ? "正在保存图片…" : product.photos.length >= 3 ? "参考图已满，可删除后更换" : "拖入图片即上传，或点击选择图片"}</strong><span>已有图片可拖动排序，也可使用图片下方的左右按钮</span></button></>}
      {readonly && !photos.length && <div className="reference-empty"><Upload size={24} /><p>尚未上传实拍参考</p></div>}
      <p aria-live="polite" role={error ? "alert" : "status"} className={error ? "form-notice error-notice" : "form-notice"}>{error || notice}</p>
    </div>
  </section>;
}
