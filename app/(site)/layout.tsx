import { cookies } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import EntryOverlay from "@/components/EntryOverlay";
import { getSiteMeta } from "@/lib/services/site";

/** 公开站点外壳：入站遮罩 + 导航 + 页脚。后台使用独立外壳，不在此渲染。 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const meta = await getSiteMeta();
  // 只看有没有会话 cookie，不发网络请求：未登录访客不该看到「背诵」入口，
  // 但真正能不能进仍由中间件与页面服务端校验决定
  const jar = await cookies();
  const hasSession = jar
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  return (
    <>
      <EntryOverlay siteName={meta.site_name} />
      <Navbar
        siteName={meta.site_name}
        extraLinks={hasSession ? [{ href: "/recite", label: "背诵" }] : []}
      />
      <main className="min-h-screen">{children}</main>
      <Footer siteName={meta.site_name} />
    </>
  );
}