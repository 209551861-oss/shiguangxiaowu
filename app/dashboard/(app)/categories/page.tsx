import CategoryManager from "@/components/dashboard/CategoryManager";
import PageHeader from "@/components/content/PageHeader";

export const metadata = { title: "分类管理 · 拾光后台" };

export default function CategoriesPage() {
  return (
    <div>
      <PageHeader
        title="分类管理"
        desc="为学习档案、资料库、创作工坊建立分类，录入时可归类，站点列表页可按分类筛选。"
      />
      <CategoryManager />
    </div>
  );
}
