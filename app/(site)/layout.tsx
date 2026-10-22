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
  return (
    <>
      <EntryOverlay siteName={meta.site_name} />
      <Navbar siteName={meta.site_name} />
      <main className="min-h-screen">{children}</main>
      <Footer siteName={meta.site_name} />
    </>
  );
}