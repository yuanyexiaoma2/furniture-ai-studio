import Link from "next/link";
import { UsersRound, ArrowUpRight, Settings2 } from "@/components/icons/concept-icons";
import { buttonVariants } from "@/components/ui/button";
export default function AdminPage() {
  return <><div className="page-intro"><div><p className="eyebrow">团队管理</p><h1>管理后台<span className="title-dot">.</span></h1><p className="intro-copy">维护团队账号与访问权限。</p></div></div><div className="admin-overview-grid"><section className="workspace-panel admin-overview-card"><UsersRound size={28} strokeWidth={1.5} /><h2>用户管理</h2><p>新增团队成员，分配角色或重置密码。</p><Link className={buttonVariants()} href="/admin/users">管理用户 <ArrowUpRight size={16} /></Link></section><section className="workspace-panel admin-overview-card"><Settings2 size={28} strokeWidth={1.5} /><h2>网关状态</h2><p>查看双网关调用、熔断与费用，测试生图和大语言模型。</p><Link className={buttonVariants()} href="/admin/gateways">管理网关 <ArrowUpRight size={16} /></Link></section></div></>;
}
