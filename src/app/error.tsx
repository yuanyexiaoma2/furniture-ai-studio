"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="not-found"><p className="eyebrow">暂时无法加载</p><h1>请稍后再试</h1><p>如果问题持续出现，请联系管理员检查服务状态。</p><Button onClick={reset}>重新加载</Button></main>;
}
