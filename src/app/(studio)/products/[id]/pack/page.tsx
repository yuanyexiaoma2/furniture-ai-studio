import Link from "next/link";
import { requireUser } from "@/lib/access";
import { packSnapshot } from "@/lib/image-packs";
import { AgentWorkspace } from "@/components/agent-workspace";
import { agentSnapshot } from "@/lib/agent-state";
export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(), { id } = await params, pack = await packSnapshot(id), agent = await agentSnapshot(id, user.id);
  return <><Link className="back-link" href={`/products/${id}`}>← 商品资料与单张创作</Link><div className="page-intro"><div><p className="eyebrow">{pack.sku} / 图包工作台</p><h1>从场景意图，到成套终稿<span className="title-dot">.</span></h1><p className="intro-copy">一起理解产品、商量图包，生成候选并逐张调整。</p></div></div><AgentWorkspace initial={agent} pack={pack} readonly={user.role === "viewer"} /></>;
}
