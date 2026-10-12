import { requireUser } from "@/lib/access";
import { Navigation } from "@/components/navigation";
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <div className="studio-shell"><Navigation name={user.name ?? "成员"} role={user.role} /><main className="studio-main">{children}</main><footer className="studio-footer"><span>家具电商 · 创意协作空间</span><span>公司内部应用</span></footer></div>;
}
