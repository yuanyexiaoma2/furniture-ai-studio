import type { Metadata } from "next";
import { PreviewProvider } from "@/components/design-preview/provider";
import "@xyflow/react/dist/style.css";
import "./preview.css";
export const metadata: Metadata = { title: "家具创作室 · 设计预览" };
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <PreviewProvider>{children}</PreviewProvider>;
}
