"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, LoaderCircle } from "@/components/icons/concept-icons";
import { Button } from "@/components/ui/button";
import { ProductFields, productFormValues } from "@/components/product-fields";

export function ProductCreate() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(productFormValues(event.currentTarget)) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "创建商品失败");
      router.push(`/products/${data.product.id}`); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "创建失败，请重试"); }
    finally { setPending(false); }
  }
  return <details className="workspace-panel new-product"><summary><Plus size={18} /><span>新建商品</span><span className="field-hint">从真实产品开始</span></summary><form onSubmit={create} className="product-form"><ProductFields disabled={pending} /><p role="alert" className="error-notice form-notice">{error}</p><Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}{pending ? "正在创建" : "创建商品"}</Button></form></details>;
}
