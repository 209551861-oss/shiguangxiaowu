import Link from "next/link";
import GlassCard from "./GlassCard";

/** 模块卡片：图标 + 标题 + 描述，悬浮上浮。 */
export default function Card({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <GlassCard className="group h-full cursor-pointer p-5 transition duration-300 hover:-translate-y-1.5 hover:border-pollen hover:shadow-card">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-pollen/30 text-2xl text-forest transition group-hover:bg-pollen/50">
          {icon}
        </div>
        <h4 className="mb-1.5 font-serif text-lg text-forest">{title}</h4>
        <p className="text-xs leading-relaxed text-muted">{desc}</p>
      </GlassCard>
    </Link>
  );
}
