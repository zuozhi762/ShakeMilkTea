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
      <head>
        <link rel="preload" as="image" href="/generated-assets/page-background.webp" />
        <link rel="preload" as="image" href="/generated-assets/ui-menu-bg.webp" />
        <link rel="preload" as="image" href="/generated-assets/ui-title-badge.webp" />
        <link rel="preload" as="image" href="/generated-assets/ui-start-button.webp" />
        <link rel="preload" as="image" href="/generated-assets/ui-leaderboard-button.webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}

