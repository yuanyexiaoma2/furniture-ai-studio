"use client";
import { useState, useRef, type FormEvent, type ReactNode } from "react";
import { Save, Sparkles, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductFields, productFormValues } from "@/components/product-fields";
import type { ProductSnapshot } from "@/lib/product-data";
import { PhotoManager } from "@/components/photo-manager";

export function ProductEditor({ product, readonly, onUpdate, children }: { product: ProductSnapshot; readonly: boolean; onUpdate?: (product: ProductSnapshot) => void; children?: ReactNode }) {
  const [current, setCurrent] = useState(product);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const identityRef = useRef<HTMLTextAreaElement>(null);
  async function analyze() {
    if (identityRef.current?.value.trim() && !window.confirm("AI 提炼会替换文本框当前内容并产生网关费用，结果不会自动保存。是否继续？")) return;
    setAnalyzing(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/products/${current.id}/identity`, { method: "POST", signal: AbortSignal.timeout(65000) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "AI 提炼失败");
      if (identityRef.current) identityRef.current.value = result.text;
      setNotice(`AI 提炼完成（${result.provider === 'kie' ? 'KIE' : 'ZenMux'}${result.fallback ? ' · 备用线路' : ''}），请核对并修改后点击保存产品资料；尚未保存。`);
    } catch (e) { setError(e instanceof Error && e.name === 'TimeoutError' ? "AI 提炼等待超时，请刷新后核对网关记录；当前文本未修改" : e instanceof Error ? e.message : "AI 提炼失败"); }
    finally { setAnalyzing(false); }
  }
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
  return <div className="product-workspace">
    <section className="workspace-panel product-information"><div className="panel-heading"><h2>01 / 产品资料</h2><span className="field-hint">真实细节 · 生成依据</span></div><form onSubmit={save} className="product-form"><ProductFields initial={current} identityRef={identityRef} disabled={readonly || pending || analyzing} identityAction={!readonly && <Button type="button" variant="outline" size="sm" onClick={() => void analyze()} disabled={pending || analyzing || current.photos.length < 2}>{analyzing ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}{analyzing ? "正在提炼…" : "AI 提炼"}</Button>} />{!readonly && <Button type="submit" disabled={pending || analyzing}><Save size={16} />保存产品资料</Button>}<p role={error ? "alert" : "status"} className={error ? "form-notice error-notice" : "form-notice"}>{error || notice}</p></form></section>
    <div className="product-creative">
      <PhotoManager product={product} readonly={readonly} onUpdate={(snapshot) => { setCurrent(snapshot); onUpdate?.(snapshot); }} />
      {children}
    </div>
  </div>;
}
