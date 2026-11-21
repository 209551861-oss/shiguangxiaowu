import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDocument, getLatestSession, getRecentQuestions } from "@/lib/services/library";
import { formatDate } from "@/utils/format";
import DocReader from "@/components/library/DocReader";
import AskPanel from "@/components/library/AskPanel";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  unyra: "归一",
  upload: "上传",
  manual: "手写",
};

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未登录不区分"不存在/不是你的"，一律先去登录，登录后自动回到这一页
  if (!user) redirect(`/dashboard/login?next=/library/${id}`);

  const doc = await getDocument(id);

  if (!doc) {
    return (
      <div className="mx-auto max-w-[760px] px-5 pb-16 pt-24">
        <div className="rounded-2xl border border-line bg-paper px-8 py-12 text-center">
          <p className="font-serif text-xl text-forest">这份资料不存在，或不属于你</p>
          <p className="mt-3 text-sm leading-7 text-muted">可能已经归档，或者这份资料不属于当前登录的账号。</p>
          <Link
            href="/library"
            className="mt-6 inline-flex rounded-full bg-forest px-6 py-2.5 text-sm text-paper transition hover:bg-ink"
          >
            返回资料库
          </Link>
        </div>
      </div>
    );
  }

  const [session, asked] = await Promise.all([getLatestSession(id), getRecentQuestions(id)]);

  return (
    <div className="mx-auto max-w-[820px] px-5 pb-20 pt-24">
      <Link href="/library" className="text-sm text-muted transition hover:text-forest">
        ← 资料库
      </Link>

      <header className="mt-4 border-b border-line pb-6">
        <h1 className="font-serif text-3xl leading-snug text-forest">{doc.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span className="rounded-pill bg-leaf/12 px-2 py-0.5 text-leaf">
            {SOURCE_LABEL[doc.source] ?? doc.source}
            {doc.goal_title ? ` · ${doc.goal_title}` : ""}
          </span>
          <span>{doc.chars.toLocaleString()} 字</span>
          <span>同步于 {formatDate(doc.source_updated_at ?? doc.updated_at)}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="#ask"
            className="rounded-full border border-line px-4 py-1.5 text-xs text-ink transition hover:border-forest hover:text-forest"
          >
            问这份资料 ↓
          </a>
        </div>
      </header>

      {asked.length > 0 && (
        <div className="mt-5 rounded-xl border border-line bg-mist/50 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted">被问过</p>
          <ul className="mt-2 space-y-1">
            {asked.slice(0, 5).map((q, i) => (
              <li key={i} className="truncate text-[13px] leading-6 text-muted">
                · {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      <article className="mt-8">
        {doc.body_md ? (
          <DocReader markdown={doc.body_md} />
        ) : (
          <p className="rounded-xl border border-dashed border-line px-5 py-6 text-sm text-muted">
            这份资料没有存正文（早期数据）。重新同步一次会把正文补上。
          </p>
        )}
      </article>

      <AskPanel
        documentId={doc.id}
        initialSession={
          session
            ? {
                id: session.id,
                turns: session.turns.map((t) => ({
                  id: t.id,
                  role: t.role,
                  content: t.content,
                  citations: t.citations,
                  model: t.model,
                  channel: t.channel,
                })),
              }
            : null
        }
      />
    </div>
  );
}
