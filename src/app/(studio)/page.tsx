import Link from "next/link";
import { Boxes, Layers3 } from "@/components/icons/concept-icons";
import { db } from "@/lib/db";
import { ProductCreate } from "@/components/product-create";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/access";
export default async function ProjectsPage() {
  const user = await requireUser();
  const products = await db.product.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, sku: true, name: true, category: true, complexity: true, _count: { select: { assets: { where: { type: "photo", deletedAt: null } } } } } });
  return <>
    <div className="page-intro"><div><p className="eyebrow">创意从产品开始</p><h1>SKU 项目<span className="title-dot">.</span></h1><p className="intro-copy">{user.name}，欢迎回来。这里是团队的产品创意工作空间。</p></div><Badge variant="outline" className="stage-badge"><span className="status-dot" />工作台已就绪</Badge></div>
    {user.role !== "viewer" && <ProductCreate />}
    <section className="workspace-panel" aria-labelledby="project-list-title"><div className="panel-heading"><div className="flex items-center gap-3"><Layers3 size={18} /><h2 id="project-list-title">全部项目</h2><span className="count-chip">{products.length}</span></div><span className="text-xs text-muted-foreground">团队产品空间</span></div>
    {products.length ? <div className="product-list">{products.map((product) => <Link key={product.id} href={`/products/${product.id}`} className="product-list-item"><span className="product-symbol"><Boxes size={23} strokeWidth={1.4} /></span><div><p className="product-sku">{product.sku}</p><h3>{product.name}</h3><p className="field-hint">{product.category} · {product._count.assets} 张实拍参考</p></div><span className="product-open">进入创作 →</span></Link>)}</div> : <div className="empty-projects"><div className="empty-illustration" aria-hidden="true"><div className="outline-square square-back" /><div className="outline-square square-front"><Boxes size={42} strokeWidth={1} /></div><span className="illustration-dot" /></div><p className="eyebrow">等待第一件作品</p><h3>还没有 SKU 项目</h3><p>新建一件商品，填写产品身份特征，<br />上传实拍图后开始场景创作。</p></div>}</section>
    <div className="workspace-note"><span className="note-number">01 /</span><p>从真实产品出发，让每一张图都准确传达产品价值。</p></div>
  </>;
}
