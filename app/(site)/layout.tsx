import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import EntryOverlay from "@/components/EntryOverlay";

/** 公开站点外壳：入站遮罩 + 导航 + 页脚。后台使用独立外壳，不在此渲染。 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <EntryOverlay />
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
