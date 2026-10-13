"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductFields, productFormValues } from "@/components/product-fields";
import type { ProductSnapshot } from "@/lib/product-data";
import { PhotoManager } from "@/components/photo-manager";

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
  return <div className="product-workspace">
    <section className="workspace-panel product-information"><div className="panel-heading"><h2>01 / 产品资料</h2><span className="field-hint">真实细节 · 生成依据</span></div><form onSubmit={save} className="product-form"><ProductFields initial={current} disabled={readonly || pending} />{!readonly && <Button type="submit" disabled={pending}><Save size={16} />保存产品资料</Button>}<p role={error ? "alert" : "status"} className={error ? "form-notice error-notice" : "form-notice"}>{error || notice}</p></form></section>
    <div className="product-creative">
      <PhotoManager product={product} readonly={readonly} onUpdate={(snapshot) => { setCurrent(snapshot); onUpdate?.(snapshot); }} />
      {children}
    </div>
  </div>;
}
