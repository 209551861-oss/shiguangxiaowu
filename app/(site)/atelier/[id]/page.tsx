import Link from "next/link";
import { getPublicItem } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import MarkdownViewer from "@/components/MarkdownViewer";
import EmptyState from "@/components/content/EmptyState";
import type { Artwork } from "@/types";

export default async function ArtworkDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await getPublicItem<Artwork>(
    "artworks",
    id,
    "id,title,description,cover_url,created_at"
  );

  if (!a) {
    return (
      <div className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
        <EmptyState
          text="这件作品不存在，或已被设为私密。"
          hint="返回创作工坊看看其他作品吧。"
        />
        <div className="mt-6 text-center">
          <Link href="/atelier" className="text-sm text-leaf hover:underline">
            ← 返回创作工坊
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
      <Link href="/atelier" className="text-sm text-muted hover:text-forest">
        ← 创作工坊
      </Link>
      <h1 className="mt-4 font-serif text-4xl leading-tight text-forest">
        {a.title}
      </h1>
      <p className="mt-2 text-sm text-muted">{formatDate(a.created_at)}</p>
      {a.cover_url && (
        <div className="mt-6 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.cover_url}
            alt={a.title}
            className="w-full object-cover"
          />
        </div>
      )}
      {a.description && (
        <div className="mt-8">
          <MarkdownViewer content={a.description} />
        </div>
      )}
    </article>
  );
}
