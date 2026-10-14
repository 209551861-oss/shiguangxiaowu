import Link from "next/link";
import type { CategoryItem } from "@/lib/services/content";

/** 分类筛选胶囊（服务端可渲染的 Link 列表）。 */
export default function CategoryFilter({
  categories,
  activeSlug,
  basePath,
}: {
  categories: CategoryItem[];
  activeSlug?: string;
  basePath: string;
}) {
  if (categories.length === 0) return null;

  const chipBase =
    "rounded-pill border px-4 py-1.5 text-sm transition";
  const activeCls = "border-leaf bg-leaf/20 text-forest font-medium";
  const idleCls = "border-line text-ink hover:bg-leaf/10";

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      <Link
        href={basePath}
        className={`${chipBase} ${!activeSlug ? activeCls : idleCls}`}
      >
        全部
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`${basePath}?cat=${c.slug}`}
          className={`${chipBase} ${activeSlug === c.slug ? activeCls : idleCls}`}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
