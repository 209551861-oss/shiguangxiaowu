import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCounts } from "@/lib/services/site";
import { MODULE_CONFIGS, MODULE_ORDER } from "@/lib/content-config";

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const counts = await getOwnerCounts(user?.id);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h1 className="font-serif text-3xl text-forest">总览</h1>
      <p className="mt-2 text-muted">
        欢迎回来，站长。当前共收录{" "}
        <b className="text-forest">{total}</b> 条内容，点击下方模块开始录入与管理。
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULE_ORDER.map((key) => {
          const m = MODULE_CONFIGS[key];
          return (
            <div
              key={key}
              className="glass flex flex-col rounded-2xl p-5 shadow-soft"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{m.icon}</span>
                <b className="font-serif text-lg text-forest">{m.label}</b>
              </div>
              <p className="mt-2 text-sm text-muted">
                已存 <b className="text-forest">{counts[m.key as keyof typeof counts]}</b>{" "}
                {m.singular}
              </p>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/dashboard/${key}`}
                  className="rounded-pill bg-leaf/15 px-4 py-2 text-sm text-forest transition hover:bg-leaf/25"
                >
                  管理
                </Link>
                <Link
                  href={`/dashboard/${key}/new`}
                  className="rounded-pill bg-pollen px-4 py-2 text-sm text-forest shadow-press transition hover:-translate-y-0.5"
                >
                  + 新建
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
