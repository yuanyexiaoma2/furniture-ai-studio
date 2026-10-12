"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { Save, Upload, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductFields, productFormValues } from "@/components/product-fields";
import type { ProductSnapshot } from "@/lib/product-data";

export function ProductEditor({ product, readonly, onUpdate, children }: { product: ProductSnapshot; readonly: boolean; onUpdate?: (product: ProductSnapshot) => void; children?: ReactNode }) {
  const [current, setCurrent] = useState(product);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/products/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(productFormValues(event.currentTarget)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setCurrent(result.product); onUpdate?.(result.product); setNotice("产品资料与身份特征已保存");
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败"); }
    finally { setPending(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    const form = event.currentTarget;
    try {
      const response = await fetch(`/api/products/${current.id}/photos`, { method: "POST", body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "上传失败");
      const snapshot = await fetch(`/api/products/${current.id}`).then((res) => res.json());
      if (!snapshot.product) throw new Error("实拍图已上传，刷新页面后查看");
      setCurrent(snapshot.product); onUpdate?.(snapshot.product); form.reset(); setNotice("实拍图已保存，可继续填写场景意图");
    } catch (error) { setError(error instanceof Error ? error.message : "上传失败"); }
    finally { setPending(false); }
  }
  return <div className="product-workspace">
    <section className="workspace-panel product-information"><div className="panel-heading"><h2>01 / 产品资料</h2><span className="field-hint">真实细节 · 生成依据</span></div><form onSubmit={save} className="product-form"><ProductFields initial={current} disabled={readonly || pending} />{!readonly && <Button type="submit" disabled={pending}><Save size={16} />保存产品资料</Button>}</form></section>
    <div className="product-creative">
      <section className="workspace-panel"><div className="panel-heading"><h2>02 / 实拍参考</h2><span className="count-chip">{current.photos.length} / 3</span></div><div className="reference-content"><p className="field-hint">上传同一件产品 2～3 张不同角度实拍图。JPEG / PNG / WEBP，单张 ≤30MB。</p><div className="reference-grid">{current.photos.map((photo, index) => <figure key={photo.id}><Image src={`/api/assets/${photo.id}`} alt={`产品实拍图 ${index + 1}`} width={photo.width} height={photo.height} unoptimized /><figcaption>参考 {String(index + 1).padStart(2, "0")}</figcaption></figure>)}{!current.photos.length && <div className="reference-empty"><Upload size={24} /><p>让产品细节成为创作的起点</p></div>}</div>{!readonly && current.photos.length < 3 && <form onSubmit={upload} className="upload-form"><label htmlFor="photos" className="sr-only">实拍参考图</label><input id="photos" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required disabled={pending} /><Button type="submit" variant="outline" disabled={pending}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}上传实拍图</Button></form>}<p aria-live="polite" className={error ? "form-notice error-notice" : "form-notice"}>{error || notice}</p></div></section>
      {children}
    </div>
  </div>;
}
