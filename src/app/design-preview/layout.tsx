import type { Metadata } from "next";
import { PreviewProvider } from "@/components/design-preview/provider";
import "@xyflow/react/dist/style.css";
import "./preview.css";
import "./round3.css";
import "./task8.css";
import "./round4.css";
export const metadata: Metadata = { title: "家具创作室 · 设计预览" };
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <PreviewProvider>{children}</PreviewProvider>;
}
