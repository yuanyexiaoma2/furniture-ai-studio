import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/access";
import { productSnapshot } from "@/lib/product-data";
import { ProductEditor } from "@/components/product-editor";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const product = await productSnapshot((await params).id);
  if (!product) notFound();
  return <><Link href="/" className="back-link">← 全部 SKU 项目</Link><div className="page-intro"><div><p className="eyebrow">{product.sku} / 产品创作空间</p><h1>{product.name}<span className="title-dot">.</span></h1><p className="intro-copy">从多角度实拍出发，保留产品身份，探索新的场景。</p></div></div><ProductEditor product={product} readonly={user.role === "viewer"} /></>;
}
