import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "摇摇奶茶大合成",
  description: "一款奶茶版召唤神龙 2D 网页小游戏。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
