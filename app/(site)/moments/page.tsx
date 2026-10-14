import { getPublicList } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import PageHeader from "@/components/content/PageHeader";
import EmptyState from "@/components/content/EmptyState";
import GlassCard from "@/components/ui/GlassCard";
import type { Moment } from "@/types";

export default async function MomentsPage() {
  const moments = await getPublicList<Moment>({
    table: "moments",
    select: "id,content,location,mood,images,created_at",
    limit: 80,
  });

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
      <PageHeader
        title="瞬间记录"
        desc="一句话、一张图的即时光阴。"
        count={moments.length}
      />
      {moments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {moments.map((m) => (
            <GlassCard key={m.id} className="p-5">
              {m.content && (
                <p className="whitespace-pre-wrap text-[15px] leading-8 text-forest">
                  {m.content}
                </p>
              )}
              {m.images && m.images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {m.images.map((img, i) =>
                    img.thumbnail ? (
                      <div
                        key={i}
                        className="aspect-square overflow-hidden rounded-xl bg-leaf/10"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.thumbnail}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{formatDate(m.created_at)}</span>
                {m.location && <span>· {m.location}</span>}
                {m.mood && <span>· {m.mood}</span>}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
