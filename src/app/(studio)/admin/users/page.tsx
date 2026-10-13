import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { UserManager } from "@/components/user-manager";
export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, department: true, monthlyQuota: true } });
  return <><div className="page-intro"><div><p className="eyebrow">管理后台 / 用户管理</p><h1>团队成员<span className="title-dot">.</span></h1><p className="intro-copy">为每一位协作者分配权限和美元月度配额。</p></div></div><UserManager initialUsers={users.map(user => ({ ...user, monthlyQuota: Number(user.monthlyQuota) }))} currentUserId={admin.id} /></>;
}
