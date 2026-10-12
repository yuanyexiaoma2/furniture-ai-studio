import { Boxes, ArrowUpRight, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/access";
export default async function ProjectsPage() {
  const user = await requireUser();
  return <>
    <div className="page-intro"><div><p className="eyebrow">创意从产品开始</p><h1>SKU 项目<span className="title-dot">.</span></h1><p className="intro-copy">{user.name}，欢迎回来。这里是团队的产品创意工作空间。</p></div><Badge variant="outline" className="stage-badge"><span className="status-dot" />工作台已就绪</Badge></div>
    <section className="workspace-panel" aria-labelledby="project-list-title"><div className="panel-heading"><div className="flex items-center gap-3"><Layers3 size={18} /><h2 id="project-list-title">全部项目</h2><span className="count-chip">0</span></div><span className="text-xs text-muted-foreground">团队产品空间</span></div>
    <div className="empty-projects"><div className="empty-illustration" aria-hidden="true"><div className="outline-square square-back" /><div className="outline-square square-front"><Boxes size={42} strokeWidth={1} /></div><span className="illustration-dot" /></div><p className="eyebrow">等待第一件作品</p><h3>还没有 SKU 项目</h3><p>产品资料、图包方案与团队创意，将在这里汇聚。<br />项目创建功能将在后续任务开放。</p><span className="coming-note">下一步 · 产品与素材管理 <ArrowUpRight size={14} /></span></div></section>
    <div className="workspace-note"><span className="note-number">01 /</span><p>从真实产品出发，让每一张图都准确传达产品价值。</p></div>
  </>;
}
