import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";

/** 友好空态：无公开内容时提示去后台录入。 */
export default function EmptyState({
  text = "这里还没有公开的内容。",
  hint = "去后台录入并设为「公开」，就会显示在这里～",
}: {
  text?: string;
  hint?: string;
}) {
  return (
    <GlassCard className="p-12 text-center">
      <span className="text-4xl">🌱</span>
      <p className="mt-4 font-serif text-xl text-forest">{text}</p>
      <p className="mt-2 text-sm text-muted">{hint}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-pill bg-pollen px-6 py-2.5 text-sm text-forest shadow-press transition hover:-translate-y-0.5"
      >
        进入后台管理 →
      </Link>
    </GlassCard>
  );
}
