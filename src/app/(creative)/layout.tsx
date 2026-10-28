import type { Metadata } from "next";
import { PreviewProvider } from "@/components/design-preview/provider";
import "@xyflow/react/dist/style.css";
import "@/styles/creative/tokens.css";
import "@/styles/creative/base.css";
import "@/styles/creative/layout.css";
import "@/styles/creative/home.css";
import "@/styles/creative/gallery.css";
import "@/styles/creative/chat.css";
import "@/styles/creative/canvas.css";
import "@/styles/creative/library.css";
import "@/styles/creative/admin.css";
export const metadata: Metadata = { title: "家具创作室" };
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <PreviewProvider>{children}</PreviewProvider>;
}
