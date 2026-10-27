"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Boxes, LayoutTemplate, Settings2, LogOut } from "@/components/icons/concept-icons";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/roles";
import { SHOW_UNCONNECTED_FEATURES } from "@/lib/ui-features";

export function Navigation({ name, role }: { name: string; role: keyof typeof roleLabels }) {
  const pathname = usePathname();
  const items = [{ href: "/skus", label: "SKU 项目", icon: Boxes }, ...(SHOW_UNCONNECTED_FEATURES ? [{ href: "/library", label: "模板库", icon: LayoutTemplate }] : []), { href: "/admin", label: "管理后台", icon: Settings2 }];
  return <header className="studio-header"><div className="studio-header-inner">
    <Link href="/" className="wordmark" aria-label="家具工作台首页"><span className="brand-symbol">F</span><span>家具<span className="wordmark-light">工作台</span></span></Link>
    <nav aria-label="主导航" className="main-nav">{items.map(({ href, label, icon: Icon }) => {
      const active = href === "/" ? pathname === "/" || pathname.startsWith("/products/") : pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "nav-link active" : "nav-link"}><Icon size={16} />{label}</Link>;
    })}</nav>
    <div className="account-menu"><div className="account-label"><strong>{name}</strong><span>{roleLabels[role]}</span></div><Button variant="ghost" size="icon" aria-label="退出登录" title="退出登录" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut size={17} /></Button></div>
  </div></header>;
}
