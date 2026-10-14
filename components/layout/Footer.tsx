import Link from "next/link";
import { NAV_LINKS } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="glass mx-auto mt-14 max-w-[1080px] rounded-2xl px-6 py-6 text-center text-sm leading-relaxed text-muted shadow-soft">
      <b className="font-serif text-forest">拾光事务所</b> · 个人数字档案馆
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-forest">
            {l.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs opacity-80">
        基于 Next.js + Supabase 构建 · 内容公开与私密并存
      </p>
    </footer>
  );
}
