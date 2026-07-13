import type { Metadata, Viewport } from "next";
import "./globals.css";

const assetPrefix = process.env.GITHUB_PAGES === "true" ? "/jan-personal" : "";
const faviconSvg = `${assetPrefix}/favicon.svg?v=3`;
const faviconPng = `${assetPrefix}/favicon-32x32.png?v=3`;
const appleTouchIcon = `${assetPrefix}/apple-touch-icon.png?v=3`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "ADHD，目标已落地",
  description: "用任务连线推进今天的小目标，用 Final Call 帮你摆脱选择困难。",
  icons: {
    icon: [
      { url: faviconPng, type: "image/png", sizes: "32x32" },
      { url: faviconSvg, type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: faviconPng,
    apple: [{ url: appleTouchIcon, type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "目标已落地",
    statusBarStyle: "default",
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
