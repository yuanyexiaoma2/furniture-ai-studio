import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { loginDestination } from "@/lib/login-destination";
export default async function LoginPage({searchParams}:{searchParams:Promise<{callbackUrl?:string|string[]}>}) {
  const destination = loginDestination((await searchParams).callbackUrl);
  if (await auth()) redirect(destination);
  return <main className="login-shell"><section className="login-story"><div className="wordmark"><span className="brand-symbol">F</span><span>家具工作台</span></div><div className="login-story-center"><p className="eyebrow">产品 · 空间 · 想象</p><h1>让产品，<br />成为故事的主角<span>.</span></h1><p>一个属于家具电商团队的创意空间。<br />让协作井然有序，让创意有处安放。</p><div className="architectural-art" aria-hidden="true"><div className="art-wall" /><div className="art-plinth" /><div className="art-chair"><i /><b /><span /></div><div className="art-floor" /></div></div><div className="story-footer"><span>家具电商 AI 生图工作台</span><span>公司内部应用</span></div></section><section className="login-form-panel"><div className="login-form-wrap"><p className="eyebrow">欢迎回到工作台</p><h2>登录你的账号</h2><p className="login-description">使用管理员分配的公司账号继续。</p><LoginForm destination={destination} /><p className="login-help">还没有账号或忘记密码？请联系管理员。</p></div><span className="login-version">工作台 · 第一阶段</span></section></main>;
}
