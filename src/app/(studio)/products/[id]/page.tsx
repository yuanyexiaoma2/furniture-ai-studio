import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/access";
import { productSnapshot } from "@/lib/product-data";
import { ProductStudio } from "@/components/product-studio";
import { generationAvailability } from "@/lib/scene-generation";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const product = await productSnapshot((await params).id);
  if (!product) notFound();
  const availability = await generationAvailability(user.id);
  return <><Link href="/" className="back-link">← 全部 SKU 项目</Link><div className="page-intro"><div><p className="eyebrow">{product.sku} / 产品创作空间</p><h1>{product.name}<span className="title-dot">.</span></h1><p className="intro-copy">从多角度实拍出发，保留产品身份，探索新的场景。</p></div></div><ProductStudio initial={product} initialAvailability={availability} readonly={user.role === "viewer"} /></>;
}
