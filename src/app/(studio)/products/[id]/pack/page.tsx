import Link from "next/link";
import { requireUser } from "@/lib/access";
import { packSnapshot } from "@/lib/image-packs";
import { ImagePackBoard } from "@/components/image-pack-board";
export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(), { id } = await params, pack = await packSnapshot(id);
  return <><Link className="back-link" href={`/products/${id}`}>← 商品资料与单张创作</Link><div className="page-intro"><div><p className="eyebrow">{pack.sku} / 图包工作台</p><h1>从场景意图，到成套终稿<span className="title-dot">.</span></h1><p className="intro-copy">逐个图位完善意图，批量探索候选，挑选后打包交付。</p></div></div><ImagePackBoard initial={pack} readonly={user.role === "viewer"} /></>;
}
