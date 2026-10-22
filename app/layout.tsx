import type { Metadata } from "next";
import { getSiteMeta } from "@/lib/services/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const meta = await getSiteMeta();
  return {
    title: `${meta.site_name}｜个人数字档案馆`,
    description:
      meta.site_tagline ||
      "记录学习、开发、创作、生活与成长。公开与私密并存的时间档案馆。",
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}