import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownViewer from "@/components/MarkdownViewer";
import { getBookTree, getSectionDetail, getCurrentUser } from "@/lib/services/curriculum";
import { saveProgress } from "../../book/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await getSectionDetail(slug);
  if (!detail) return { title: "找不到这一节 · 拾光小屋" };
  return { title: `${detail.title} · 学习` };
}

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const [user, tree, detail] = await Promise.all([
    getCurrentUser(),
    getBookTree(),
    getSectionDetail(slug),
  ]);

  if (!detail) notFound();

  const flat = tree?.chapters.flatMap((c) => c.sections) ?? [];
  const pos = flat.findIndex((s) => s.slug === detail.slug) + 1;

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-24 pt-24">
      {/* 顶部：位置 + 退出 */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {detail.chapterTitle}
            {pos > 0 && ` · 第 ${pos} / ${flat.length} 节`}
          </p>
          <h1 className="mt-2 font-serif text-2xl leading-snug text-forest">{detail.title}</h1>
        </div>
        <Link
          href={`/book?section=${detail.slug}`}
          className="shrink-0 rounded-full border border-line px-4 py-2 text-xs text-muted transition hover:border-forest hover:text-forest"
        >
          回目录
        </Link>
      </div>

      {sp.msg === "saved" && (
        <div className="mb-6 rounded-xl border border-leaf/40 bg-leaf/10 px-4 py-3 text-sm text-forest">
          已记录
        </div>
      )}
      {sp.msg === "note-required" && (
        <div className="mb-6 rounded-xl border border-pollen/50 bg-pollen/10 px-4 py-3 text-sm text-ink">
          「卡住了」要写一行说明
        </div>
      )}
      {sp.msg === "login" && (
        <div className="mb-6 rounded-xl border border-pollen/50 bg-pollen/10 px-4 py-3 text-sm text-ink">
          登录后才能记录进度
        </div>
      )}

      {detail.progress?.status === "completed" && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">
          <span className="text-leaf">✓</span>
          这节已经标记为学完
          {detail.progress.completed_content_version !== detail.content_version && (
            <span className="ml-1 text-ink">（但教材已更新，建议重读）</span>
          )}
        </div>
      )}

      {/* 目标：学习模式里只留一句最关键的方向 */}
      {detail.goals.length > 0 && (
        <div className="mb-10 rounded-2xl border border-line bg-paper px-6 py-5">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">这节要做到</p>
          <ul className="space-y-1.5">
            {detail.goals.map((g, i) => (
              <li key={i} className="text-sm leading-7 text-ink">
                {i + 1}. {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MarkdownViewer content={detail.body_md} />

      {detail.examples.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-serif text-xl text-forest">动手看一眼</h2>
          <div className="space-y-4">
            {detail.examples.map((ex, i) => (
              <div key={i} className="rounded-xl border border-line bg-paper px-5 py-4">
                <p className="mb-3 text-sm font-medium text-forest">{ex.title}</p>
                {ex.code && (
                  <pre className="overflow-x-auto rounded-lg bg-ink/95 px-4 py-3 text-[12.5px] leading-6 text-paper">
                    <code>{ex.code}</code>
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {detail.exercises.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-serif text-xl text-forest">现在做这个</h2>
          <ol className="space-y-3">
            {detail.exercises.map((ex, i) => (
              <li key={i} className="rounded-xl border border-line bg-paper px-5 py-4">
                <p className="text-sm leading-7 text-ink">
                  <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
                  {ex.prompt}
                </p>
                {ex.hint && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted marker:hidden">
                      卡住了看提示
                    </summary>
                    <p className="mt-2 text-sm leading-7 text-muted">{ex.hint}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {detail.acceptance && (
        <section className="mt-10 rounded-2xl border-2 border-leaf/40 bg-leaf/5 px-6 py-5">
          <h2 className="mb-2 text-sm font-medium text-forest">做到这些就算过</h2>
          <p className="text-sm leading-8 text-ink">{detail.acceptance}</p>
        </section>
      )}

      {/* 收尾：完成或卡住 */}
      <section className="mt-12 border-t border-line pt-8">
        <div className="flex flex-wrap gap-3">
          <form action={saveProgress}>
            <input type="hidden" name="sectionId" value={detail.id} />
            <input type="hidden" name="slug" value={detail.slug} />
            <input type="hidden" name="contentVersion" value={detail.content_version} />
            <input type="hidden" name="action" value="complete" />
            <input type="hidden" name="back" value={`/study/${detail.slug}`} />
            <button
              type="submit"
              className="rounded-full bg-forest px-7 py-3 text-sm text-paper transition hover:bg-ink"
            >
              学完了
            </button>
          </form>

          {detail.next && (
            <Link
              href={`/study/${detail.next.slug}`}
              className="rounded-full border border-line px-6 py-3 text-sm text-ink transition hover:border-forest hover:text-forest"
            >
              下一节：{detail.next.title.slice(0, 12)}…
            </Link>
          )}
        </div>

        <form action={saveProgress} className="mt-6 space-y-2">
          <input type="hidden" name="sectionId" value={detail.id} />
          <input type="hidden" name="slug" value={detail.slug} />
          <input type="hidden" name="action" value="stuck" />
          <input type="hidden" name="back" value={`/study/${detail.slug}`} />
          <input
            name="note"
            maxLength={200}
            placeholder="哪一步卡住了？写一行，明天从这继续"
            defaultValue={detail.progress?.stuck_note ?? ""}
            className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-forest"
          />
          <button
            type="submit"
            className="rounded-full border border-line px-5 py-2 text-xs text-muted transition hover:border-forest hover:text-forest"
          >
            卡在这了
          </button>
        </form>

        {!user && (
          <p className="mt-3 text-xs text-muted">
            未登录，按钮不会保存。
            <Link href="/dashboard/login" className="ml-1 text-forest underline underline-offset-4">
              去登录
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
