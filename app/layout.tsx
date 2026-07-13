import type { Metadata } from "next";
import "./globals.css";

const faviconPath = process.env.GITHUB_PAGES === "true"
  ? "/jan-personal/favicon.svg?v=2"
  : "/favicon.svg?v=2";

export const metadata: Metadata = {
  title: "ADHD，目标已落地",
  description: "用任务连线推进今天的小目标，用 Final Call 帮你摆脱选择困难。",
  icons: {
    icon: [{ url: faviconPath, type: "image/svg+xml", sizes: "any" }],
    shortcut: faviconPath,
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
