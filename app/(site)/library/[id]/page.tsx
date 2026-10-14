import Link from "next/link";
import { getPublicItem } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import EmptyState from "@/components/content/EmptyState";
import GlassCard from "@/components/ui/GlassCard";
import type { Resource } from "@/types";

export default async function ResourceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getPublicItem<Resource>(
    "resources",
    id,
    "id,title,url,description,file_type,created_at"
  );

  if (!r) {
    return (
      <div className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
        <EmptyState
          text="这条资料不存在，或已被设为私密。"
          hint="返回资料库看看其他收藏吧。"
        />
        <div className="mt-6 text-center">
          <Link href="/library" className="text-sm text-leaf hover:underline">
            ← 返回资料库
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
      <Link href="/library" className="text-sm text-muted hover:text-forest">
        ← 资料库
      </Link>
      <h1 className="mt-4 font-serif text-4xl leading-tight text-forest">
        {r.title}
      </h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-muted">
        <span>{formatDate(r.created_at)}</span>
        {r.file_type && (
          <span className="rounded-pill bg-leaf/12 px-2.5 py-0.5 text-[11px] text-leaf">
            {r.file_type}
          </span>
        )}
      </div>

      {r.description && (
        <p className="mt-6 whitespace-pre-wrap leading-[2] text-ink">
          {r.description}
        </p>
      )}

      {r.url && (
        <GlassCard className="mt-6 flex items-center justify-between gap-4 p-5">
          <span className="truncate text-sm text-muted">{r.url}</span>
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-pill bg-forest px-5 py-2 text-sm text-white transition hover:-translate-y-0.5"
          >
            访问链接 →
          </a>
        </GlassCard>
      )}
    </article>
  );
}
