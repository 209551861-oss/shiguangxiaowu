import { getPublicList } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import PageHeader from "@/components/content/PageHeader";
import ContentCard from "@/components/content/ContentCard";
import EmptyState from "@/components/content/EmptyState";
import type { Album } from "@/types";

export default async function GalleryPage() {
  const albums = await getPublicList<Album>({
    table: "albums",
    select: "id,title,description,cover_url,created_at",
    limit: 60,
  });

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-12 pt-20">
      <PageHeader
        title="生活相册"
        desc="按相册归档的影像记忆。"
        count={albums.length}
      />
      {albums.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((al) => (
            <ContentCard
              key={al.id}
              href={`/gallery/${al.id}`}
              cover={al.cover_url ?? undefined}
              title={al.title}
              desc={al.description ?? ""}
              meta={formatDate(al.created_at)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
