import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLastSync, listDocuments } from "@/lib/services/library";
import { formatDate } from "@/utils/format";
import SyncButton from "@/components/library/SyncButton";

export const metadata = {
  title: "资料库 · 拾光小屋",
  description: "从归一同步来的笔记与资料，问它就能带出处回答。",
};

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "unyra", label: "归一" },
  { key: "upload", label: "上传" },
] as const;

const SOURCE_LABEL: Record<string, string> = {
  unyra: "归一",
  upload: "上传",
  manual: "手写",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const sp = await searchParams;
  const active = sp.source && sp.source !== "all" ? sp.source : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [docs, lastSync] = await Promise.all([listDocuments(active), getLastSync()]);
  const chars = docs.reduce((n, d) => n + (d.chars || 0), 0);

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-16 pt-24">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">资料库</p>
          <h1 className="mt-2 font-serif text-3xl text-forest">资料与出处</h1>
          <p className="mt-3 max-w-[560px] text-sm leading-7 text-muted">
            归一里写下的笔记会同步到这里。点开任何一份，都能就着原文提问，回答会带 [S1] 这样的出处，点一下跳回原句。
          </p>
        </div>
        {user ? <SyncButton /> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => {
            const on = active === f.key;
            const href = f.key === "all" ? "/library" : `/library?source=${f.key}`;
            return (
              <Link
                key={f.key}
                href={href}
                className={`rounded-pill px-3.5 py-1.5 text-[13px] transition ${
                  on
                    ? "bg-forest text-paper"
                    : "border border-line text-muted hover:border-forest hover:text-forest"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          {docs.length} 份 · {(chars / 1000).toFixed(1)}k 字
          {lastSync ? ` · 上次同步 ${formatDate(lastSync.at)}` : ""}
        </p>
      </div>

      {lastSync && !lastSync.ok && (
        <div className="mt-4 rounded-xl border border-pollen/50 bg-pollen/10 px-4 py-3 text-sm leading-7 text-ink">
          <span className="mr-2 text-xs text-muted">上次同步没成功</span>
          {lastSync.reason ?? "原因未知"}
        </div>
      )}

      {!user ? (
        <div className="mt-10 rounded-2xl border border-line bg-paper px-8 py-12 text-center">
          <p className="font-serif text-xl text-forest">登录后才能看资料库</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            资料和问答都是私人内容，需要先登录。
          </p>
          <Link
            href="/dashboard/login"
            className="mt-6 inline-flex rounded-full bg-forest px-6 py-2.5 text-sm text-paper transition hover:bg-ink"
          >
            去登录
          </Link>
        </div>
      ) : docs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-paper px-8 py-12 text-center">
          <p className="font-serif text-xl text-forest">还没有资料</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            归一出资料后会自动出现在这里；也可以点右上「立即同步归一」手动拉一次。
          </p>
          <Link
            href="/book"
            className="mt-6 inline-flex rounded-full border border-line px-6 py-2.5 text-sm text-ink transition hover:border-forest hover:text-forest"
          >
            先去读教材 →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/library/${d.id}`}
                className="group flex flex-wrap items-center gap-x-5 gap-y-2 px-2 py-5 transition hover:bg-mist/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg text-forest group-hover:text-ink">
                    {d.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    <span className="rounded-pill bg-leaf/12 px-2 py-0.5 text-leaf">
                      {SOURCE_LABEL[d.source] ?? d.source}
                      {d.goal_title ? ` · ${d.goal_title}` : ""}
                    </span>
                    <span>{d.chars.toLocaleString()} 字</span>
                    <span>{d.chunkCount} 段</span>
                    <span>{formatDate(d.updated_at)}</span>
                  </span>
                </span>
                <span className="shrink-0 text-sm text-muted transition group-hover:translate-x-0.5 group-hover:text-forest">
                  问这份 →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
