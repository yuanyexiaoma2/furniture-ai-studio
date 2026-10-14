import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "家具工作台",
  description: "家具电商团队内部创意工作空间",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
