import PageHeader from "@/components/content/PageHeader";
import SiteSettingsManager from "@/components/dashboard/SiteSettingsManager";

export const metadata = { title: "站点设置 · 拾光后台" };

export default function SiteSettingsPage() {
  return (
    <div>
      <PageHeader
        title="站点设置"
        desc="站点名称、标语、关于我与社交链接会直接显示在公开站点；保存后刷新前台即可看到。"
      />
      <SiteSettingsManager />
    </div>
  );
}