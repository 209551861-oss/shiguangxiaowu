import { getPublicList, getCategories, type CategoryItem } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import PageHeader from "@/components/content/PageHeader";
import ContentCard from "@/components/content/ContentCard";
import EmptyState from "@/components/content/EmptyState";
import CategoryFilter from "@/components/content/CategoryFilter";
import type { Artwork } from "@/types";

export default async function AtelierPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const sp = await searchParams;
  const activeSlug = sp.cat?.trim();

  const categories = await getCategories("atelier");
  const active = categories.find((c) => c.slug === activeSlug);
  const catName = new Map<string, string>(categories.map((c: CategoryItem) => [c.id, c.name]));

  const artworks = await getPublicList<Artwork>({
    table: "artworks",
    select: "id,title,description,cover_url,category_id,created_at",
    limit: 60,
    eq: active ? { category_id: active.id } : undefined,
  });

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-12 pt-20">
      <PageHeader
        title="创作工坊"
        desc="绘画与作品的原稿与过程记录。"
        count={artworks.length}
      />
      <CategoryFilter categories={categories} activeSlug={activeSlug} basePath="/atelier" />
      {artworks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {artworks.map((a) => (
            <ContentCard
              key={a.id}
              href={`/atelier/${a.id}`}
              cover={a.cover_url ?? undefined}
              title={a.title}
              desc={a.description ?? ""}
              badge={a.category_id ? (catName.get(a.category_id) ?? undefined) : undefined}
              meta={formatDate(a.created_at)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
