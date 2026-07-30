import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "这杯有点太刺激了",
  description: "在温暖手帐风奶茶杯里合成小料，躲开刺激吸管。",
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
