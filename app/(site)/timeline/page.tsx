import { getPublicList } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import PageHeader from "@/components/content/PageHeader";
import EmptyState from "@/components/content/EmptyState";
import type { TimelineEvent } from "@/types";

export default async function TimelinePage() {
  const events = await getPublicList<TimelineEvent>({
    table: "timeline_events",
    select: "id,title,happened_at,description,icon",
    orderBy: "happened_at",
    ascending: true,
    limit: 300,
  });

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
      <PageHeader
        title="成长时间轴"
        desc="重要节点串联起的个人编年。"
        count={events.length}
      />
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-[14px] top-2 bottom-2 w-px bg-line" />
          <div className="flex flex-col gap-7">
            {events.map((e) => (
              <div key={e.id} className="relative">
                <span className="absolute -left-8 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-pollen text-sm text-forest shadow-press">
                  {e.icon || "◆"}
                </span>
                <time className="font-serif text-lg text-leaf">
                  {formatDate(e.happened_at)}
                </time>
                <h3 className="mt-1 font-serif text-xl text-forest">{e.title}</h3>
                {e.description && (
                  <p className="mt-1.5 leading-8 text-ink">{e.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
