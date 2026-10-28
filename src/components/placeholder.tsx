import type { LucideIcon } from "@/components/icons/concept-icons";
import { Badge } from "@/components/ui/badge";
export function Placeholder({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return <><div className="page-intro"><div><p className="eyebrow">工作空间</p><h1>{title}<span className="title-dot">.</span></h1><p className="intro-copy">{description}</p></div><Badge variant="outline">规划中</Badge></div><section className="workspace-panel placeholder-panel"><Icon size="md" strokeWidth={1} /><h2>即将开放</h2><p>当前阶段已完成账号登录与权限配置。<br />此模块将在后续任务中建设。</p></section></>;
}
