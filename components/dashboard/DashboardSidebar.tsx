"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODULE_CONFIGS, MODULE_ORDER } from "@/lib/content-config";

export default function DashboardSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/dashboard/login");
    router.refresh();
  }

  const linkBase =
    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition";
  const active = "bg-leaf/20 text-forest font-medium";
  const idle = "text-ink hover:bg-leaf/10";

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-paper/60 px-4 py-6 md:flex">
      <Link href="/" className="mb-6 flex items-baseline gap-2 px-2">
        <b className="font-serif text-lg text-forest">拾光后台</b>
        <span className="text-[10px] tracking-[0.28em] text-muted">ADMIN</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        <Link
          href="/dashboard"
          className={`${linkBase} ${pathname === "/dashboard" ? active : idle}`}
        >
          📊 总览
        </Link>

        <div className="mt-3 px-3 text-xs tracking-widest text-muted">内容模块</div>
        {MODULE_ORDER.map((key) => {
          const m = MODULE_CONFIGS[key];
          const href = `/dashboard/${key}`;
          const on = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={key} href={href} className={`${linkBase} ${on ? active : idle}`}>
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </Link>
          );
        })}

        <div className="mt-3 px-3 text-xs tracking-widest text-muted">管理</div>
        <Link
          href="/dashboard/categories"
          className={`${linkBase} ${pathname.startsWith("/dashboard/categories") ? active : idle}`}
        >
          <span>🏷️</span>
          <span>分类管理</span>
        </Link>
        <Link
          href="/dashboard/settings"
          className={`${linkBase} ${pathname.startsWith("/dashboard/settings") ? active : idle}`}
        >
          <span>⚙️</span>
          <span>站点设置</span>
        </Link>
      </nav>

      <div className="mt-4 border-t border-line pt-4">
        <p className="truncate px-3 text-xs text-muted" title={email}>
          {email || "站长"}
        </p>
        <div className="mt-2 flex flex-col gap-1">
          <Link
            href="/"
            className="rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-leaf/10"
          >
            ↗ 查看站点
          </Link>
          <button
            onClick={logout}
            className="rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-bloom/30"
          >
            退出登录
          </button>
        </div>
      </div>
    </aside>
  );
}
