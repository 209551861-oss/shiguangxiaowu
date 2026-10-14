import Link from "next/link";
import { getPublicItem, getPublicList } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import EmptyState from "@/components/content/EmptyState";
import GlassCard from "@/components/ui/GlassCard";
import type { Album, Photo } from "@/types";

export default async function AlbumDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getPublicItem<Album>(
    "albums",
    id,
    "id,title,description,cover_url,created_at"
  );

  if (!album) {
    return (
      <div className="mx-auto max-w-[1080px] px-5 pb-12 pt-20">
        <EmptyState
          text="这个相册不存在，或已被设为私密。"
          hint="返回相册首页看看其他相册吧。"
        />
        <div className="mt-6 text-center">
          <Link href="/gallery" className="text-sm text-leaf hover:underline">
            ← 返回相册
          </Link>
        </div>
      </div>
    );
  }

  const photos = await getPublicList<Photo>({
    table: "photos",
    select: "id,thumbnail_url,caption,taken_at",
    eq: { album_id: id },
    limit: 200,
  });

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-12 pt-20">
      <Link href="/gallery" className="text-sm text-muted hover:text-forest">
        ← 相册
      </Link>
      <h1 className="mt-4 font-serif text-4xl leading-tight text-forest">
        {album.title}
      </h1>
      {album.description && (
        <p className="mt-2 max-w-[640px] leading-8 text-muted">
          {album.description}
        </p>
      )}
      <p className="mt-1 text-sm text-muted">{formatDate(album.created_at)}</p>

      {photos.length === 0 ? (
        <GlassCard className="mt-8 p-12 text-center text-sm text-muted">
          这个相册还没有公开照片。
        </GlassCard>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure
              key={p.id}
              className="overflow-hidden rounded-2xl bg-leaf/10 shadow-soft"
            >
              {p.thumbnail_url ? (
                <img
                  src={p.thumbnail_url}
                  alt={p.caption ?? ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center text-3xl text-leaf/40">
                  ✿
                </div>
              )}
              {(p.caption || p.taken_at) && (
                <figcaption className="px-3 py-2 text-xs text-muted">
                  {p.caption}
                  {p.caption && p.taken_at && " · "}
                  {p.taken_at ? formatDate(p.taken_at) : ""}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
