"use client";
import { useState, type FormEvent } from "react";
import { UsersRound, Plus, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { roleLabels } from "@/lib/roles";

export type UserSummary = { id: string; name: string; email: string; role: keyof typeof roleLabels; department: string | null; monthlyQuota: number };

function RoleOptions() { return Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>); }

async function mutate(url: string, method: string, data: unknown): Promise<UserSummary> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "操作失败，请重试");
  return result.user;
}

function UserRow({ user, currentUserId, onUpdate }: { user: UserSummary; currentUserId: string; onUpdate: (value: UserSummary) => void }) {
  const [role, setRole] = useState(user.role);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function save(action: "role" | "password", password?: string) {
    setPending(true); setNotice(""); setError("");
    try {
      onUpdate(await mutate(`/api/admin/users/${user.id}`, "PATCH", action === "role" ? { action, role } : { action, password }));
      setNotice(action === "role" ? "角色已更新，该成员需重新登录" : "密码已重置，旧会话已失效");
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "操作失败"); return false; }
    finally { setPending(false); }
  }
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await save("password", String(data.get("password")))) form.reset();
  }
  return <article className="user-row" data-testid={`user-${user.email}`}>
    <div className="user-row-main"><div className="user-avatar" aria-hidden="true">{user.name.slice(0, 1)}</div><div className="user-info"><strong>{user.name}</strong><span>{user.email}</span></div><Badge variant="secondary">{roleLabels[user.role]}</Badge><span className="user-meta">{user.department || "未分配部门"} · 月度配额 {user.monthlyQuota}</span></div>
    <div className="user-row-actions"><Label htmlFor={`role-${user.id}`} className="sr-only">{user.name}的角色</Label><select id={`role-${user.id}`} className="studio-select" value={role} onChange={(event) => setRole(event.target.value as UserSummary["role"])} disabled={pending || currentUserId === user.id}><RoleOptions /></select><Button variant="outline" type="button" disabled={pending || role === user.role || currentUserId === user.id} onClick={() => save("role")}>保存角色</Button><details className="password-details"><summary>重置密码</summary><form onSubmit={resetPassword} className="password-reset-form"><Label htmlFor={`password-${user.id}`}>新密码</Label><Input id={`password-${user.id}`} type="password" name="password" minLength={12} required autoComplete="new-password" placeholder="至少 12 个字符" /><Button type="submit" disabled={pending}>确认重置</Button></form></details></div>
    <p aria-live="polite" className={error ? "row-notice error-notice" : "row-notice"}>{error || notice}</p>
  </article>;
}

export function UserManager({ initialUsers, currentUserId }: { initialUsers: UserSummary[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const user = await mutate("/api/admin/users", "POST", { name: data.get("name"), email: data.get("email"), password: data.get("password"), role: data.get("role"), department: data.get("department"), monthlyQuota: Number(data.get("monthlyQuota")) });
      setUsers((current) => [user, ...current]); form.reset(); setNotice("用户已创建，可以使用该邮箱和初始密码登录");
    } catch (error) { setError(error instanceof Error ? error.message : "创建失败"); }
    finally { setPending(false); }
  }
  return <div className="user-management-grid"><section className="workspace-panel create-user-panel"><div className="panel-heading"><div className="flex items-center gap-2"><Plus size={18} /><h2>新增用户</h2></div></div><form onSubmit={create} className="create-user-form" aria-label="新增用户表单">
    <div className="space-y-2"><Label htmlFor="new-name">姓名</Label><Input id="new-name" name="name" required maxLength={80} placeholder="成员姓名" /></div>
    <div className="space-y-2"><Label htmlFor="new-email">邮箱</Label><Input id="new-email" name="email" type="email" required maxLength={254} autoComplete="off" placeholder="成员的公司邮箱" /></div>
    <div className="space-y-2"><Label htmlFor="new-password">初始密码</Label><Input id="new-password" name="password" type="password" required minLength={12} autoComplete="new-password" placeholder="至少 12 个字符" /></div>
    <div className="form-two-col"><div className="space-y-2"><Label htmlFor="new-role">角色</Label><select id="new-role" name="role" defaultValue="designer" className="studio-select"><RoleOptions /></select></div><div className="space-y-2"><Label htmlFor="new-quota">月度配额</Label><Input id="new-quota" type="number" name="monthlyQuota" min={0} max={1000000} defaultValue={100} required /></div></div>
    <div className="space-y-2"><Label htmlFor="new-department">部门（可选）</Label><Input id="new-department" name="department" maxLength={80} placeholder="如：设计部" /></div>
    <p aria-live="polite" className={error ? "form-notice error-notice" : "form-notice"}>{error || notice}</p><Button type="submit" disabled={pending} className="w-full h-10">{pending ? <LoaderCircle className="animate-spin" /> : <Check size={16} />}{pending ? "正在创建" : "创建用户"}</Button>
  </form></section><section className="workspace-panel users-panel"><div className="panel-heading"><div className="flex items-center gap-3"><UsersRound size={18} /><h2>团队成员</h2><span className="count-chip">{users.length}</span></div></div><div>{users.map((user) => <UserRow key={user.id} user={user} currentUserId={currentUserId} onUpdate={(updated) => setUsers((current) => current.map((value) => value.id === updated.id ? updated : value))} />)}</div></section></div>;
}
