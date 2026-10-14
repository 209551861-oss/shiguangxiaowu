import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";

/** 内容卡片：可选封面图 + 标题 + 描述 + 元信息，悬浮上浮。 */
export default function ContentCard({
  href,
  cover,
  title,
  desc,
  meta,
  badge,
}: {
  href: string;
  cover?: string;
  title: string;
  desc?: string;
  meta?: string;
  badge?: string;
}) {
  return (
    <Link href={href}>
      <GlassCard className="group h-full overflow-hidden transition duration-300 hover:-translate-y-1.5 hover:border-pollen hover:shadow-card">
        {cover ? (
          <div className="aspect-[16/10] w-full overflow-hidden bg-leaf/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-mist to-leaf/15 text-4xl text-leaf/40">
            ✿
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-serif text-lg leading-snug text-forest">{title}</h4>
            {badge && (
              <span className="shrink-0 rounded-pill bg-leaf/12 px-2.5 py-0.5 text-[11px] text-leaf">
                {badge}
              </span>
            )}
          </div>
          {desc && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
              {desc}
            </p>
          )}
          {meta && <p className="mt-3 text-xs text-muted">{meta}</p>}
        </div>
      </GlassCard>
    </Link>
  );
}
