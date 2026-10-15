import Link from "next/link";
import { ShieldX } from "@/components/icons/concept-icons";
import { buttonVariants } from "@/components/ui/button";
export default function ForbiddenPage() {
  return <section className="workspace-panel placeholder-panel"><ShieldX size={40} strokeWidth={1.4} /><p className="eyebrow">403 · 访问受限</p><h1>没有访问权限</h1><p>管理后台仅对管理员开放。<br />如需调整权限，请联系管理员。</p><Link className={buttonVariants()} href="/">返回 SKU 项目</Link></section>;
}
