"use client";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {ArrowRight,LoaderCircle} from "@/components/icons/concept-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ destination }: { destination: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState({email:"",password:""});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget);
    // 只补表单行内校验，凭证提交和鉴权协议保持原样。
    const email=event.currentTarget.elements.namedItem("email") as HTMLInputElement;
    const next={email:!String(data.get("email")??"").trim()?"请输入公司邮箱":email.validity.typeMismatch?"请输入有效的邮箱地址":"",password:!String(data.get("password")??"")?"请输入密码":""};
    setFields(next);
    if(next.email||next.password){(next.email?email:event.currentTarget.elements.namedItem("password") as HTMLInputElement).focus();return;}
    setPending(true);
    try {
      const result = await signIn("credentials", { email: data.get("email"), password: data.get("password"), redirect: false });
      if (result?.error) { setError("邮箱或密码不正确，请重新输入"); return; }
      router.replace(destination); router.refresh();
    } catch { setError("暂时无法登录，请稍后重试"); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} noValidate className="space-y-5">
    <div className="space-y-2"><Label htmlFor="email">公司邮箱</Label><Input id="email" name="email" type="email" autoComplete="username" placeholder="你的公司邮箱" required maxLength={254} aria-invalid={!!fields.email} aria-describedby={fields.email?"email-error":undefined} onChange={()=>fields.email&&setFields(old=>({...old,email:""}))}/>{fields.email&&<p id="email-error" role="alert" className="text-sm text-destructive">{fields.email}</p>}</div>
    <div className="space-y-2"><Label htmlFor="password">密码</Label><Input id="password" name="password" type="password" autoComplete="current-password" placeholder="输入账号密码" required aria-invalid={!!fields.password} aria-describedby={fields.password?"password-error":undefined} onChange={()=>fields.password&&setFields(old=>({...old,password:""}))}/>{fields.password&&<p id="password-error" role="alert" className="text-sm text-destructive">{fields.password}</p>}</div>
    <p role="alert" className="text-sm text-destructive min-h-5">{error}</p>
    <Button type="submit" className="w-full h-12 justify-between" disabled={pending}>{pending ? "正在登录" : "进入工作台"}{pending ? <LoaderCircle className="animate-spin" /> : <ArrowRight size="sm" />}</Button>
  </form>;
}
