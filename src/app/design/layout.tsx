import type { Metadata } from "next";
import "./design.css";

export const metadata: Metadata = { title: "界面设计预览 · 家具工作台" };

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
