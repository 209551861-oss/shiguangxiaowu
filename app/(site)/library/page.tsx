import { getPublicList, getCategories, type CategoryItem } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import PageHeader from "@/components/content/PageHeader";
import ContentCard from "@/components/content/ContentCard";
import EmptyState from "@/components/content/EmptyState";
import CategoryFilter from "@/components/content/CategoryFilter";
import type { Resource } from "@/types";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const sp = await searchParams;
  const activeSlug = sp.cat?.trim();

  const categories = await getCategories("library");
  const active = categories.find((c) => c.slug === activeSlug);
  const catName = new Map<string, string>(categories.map((c: CategoryItem) => [c.id, c.name]));

  const resources = await getPublicList<Resource>({
    table: "resources",
    select: "id,title,description,url,file_type,category_id,created_at",
    limit: 60,
    eq: active ? { category_id: active.id } : undefined,
  });

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-12 pt-20">
      <PageHeader
        title="资料库"
        desc="收藏的链接、文档与素材索引，随时取用。"
        count={resources.length}
      />
      <CategoryFilter categories={categories} activeSlug={activeSlug} basePath="/library" />
      {resources.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <ContentCard
              key={r.id}
              href={`/library/${r.id}`}
              title={r.title}
              desc={r.description ?? ""}
              badge={catName.get(r.category_id ?? "") ?? r.file_type ?? "资料"}
              meta={formatDate(r.created_at)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
