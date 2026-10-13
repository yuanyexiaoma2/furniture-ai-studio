"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductFormData } from "@/lib/product-validation";
import type { ReactNode, Ref } from "react";

export function ProductFields({ initial, disabled = false, identityAction, identityRef }: { initial?: Partial<ProductFormData>; disabled?: boolean; identityAction?: ReactNode; identityRef?: Ref<HTMLTextAreaElement> }) {
  return <fieldset disabled={disabled} className="product-fields">
    <div className="form-two-col"><Field name="sku" label="SKU" value={initial?.sku} placeholder="如 TEST-001" max={100} /><Field name="name" label="商品名称" value={initial?.name} placeholder="如 橡木双门收纳柜" max={200} /></div>
    <div className="form-two-col"><Field name="category" label="品类" value={initial?.category} placeholder="如 收纳柜" max={100} /><Field name="dimensions" label="尺寸" value={initial?.dimensions} placeholder="宽 × 深 × 高，注明单位" max={500} /></div>
    <div className="form-two-col"><Field name="colors" label="颜色" value={initial?.colors} placeholder="如 自然橡木色" max={500} /><Field name="materials" label="材质（可选）" value={initial?.materials} placeholder="如 橡木贴皮、金属" required={false} max={500} /></div>
    <div className="field-stack"><Label htmlFor="sellingPoints">卖点</Label><textarea id="sellingPoints" name="sellingPoints" className="studio-textarea" required maxLength={3000} defaultValue={initial?.sellingPoints} placeholder="收纳方式、使用场景与产品优势" rows={3} /></div>
    <div className="field-stack"><Label htmlFor="complexity">产品复杂度</Label><select id="complexity" name="complexity" className="studio-select" defaultValue={initial?.complexity || "simple"}><option value="simple">simple · 简单结构</option><option value="complex">complex · 复杂结构</option></select></div>
    <div className="field-stack"><div className="identity-heading"><Label htmlFor="identityTraits">产品身份特征</Label>{identityAction}</div><textarea ref={identityRef} id="identityTraits" name="identityTraits" className="studio-textarea" maxLength={10000} rows={8} defaultValue={initial?.identityTraits} placeholder="结构与部件数量、尺寸比例、颜色与材质纹理、五金样式与位置、Logo。请对照实拍图填写。" /><p className="field-hint">这些细节会在生成中锁定。AI 提炼使用已保存的资料和 2～3 张实拍图，请核对修改后手动保存。</p></div>
  </fieldset>;
}
function Field({ name, label, value, placeholder, required = true, max }: { name: string; label: string; value?: string; placeholder: string; required?: boolean; max: number }) {
  return <div className="field-stack"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={value || ""} placeholder={placeholder} required={required} maxLength={max} /></div>;
}
export function productFormValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}
