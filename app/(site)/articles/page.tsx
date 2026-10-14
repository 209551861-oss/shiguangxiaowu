import { getPublicList } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import PageHeader from "@/components/content/PageHeader";
import ContentCard from "@/components/content/ContentCard";
import EmptyState from "@/components/content/EmptyState";
import type { Article } from "@/types";

export default async function ArticlesPage() {
  const articles = await getPublicList<Article>({
    table: "articles",
    select: "id,title,slug,cover_url,published_at,created_at",
    limit: 60,
  });

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-12 pt-20">
      <PageHeader
        title="文章"
        desc="长文随笔与深度分享。"
        count={articles.length}
      />
      {articles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ContentCard
              key={a.id}
              href={`/articles/${a.slug}`}
              cover={a.cover_url ?? undefined}
              title={a.title}
              meta={formatDate(a.published_at) || formatDate(a.created_at)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
