import Link from "next/link";
import MarkdownViewer from "@/components/MarkdownViewer";
import { getBookTree, getSectionDetail, getCurrentUser } from "@/lib/services/curriculum";
import { saveProgress } from "./actions";

export const metadata = {
  title: "教材 · 拾光小屋",
  description: "按章节读、学完打勾、卡住留一行。",
};

const MSG: Record<string, { text: string; tone: "ok" | "warn" }> = {
  saved: { text: "已记录", tone: "ok" },
  login: { text: "登录后才能记录进度", tone: "warn" },
  "note-required": { text: "「卡住了」要写一行说明，否则下次不知道自己卡在哪", tone: "warn" },
  "save-failed": { text: "保存失败，请重试", tone: "warn" },
  missing: { text: "请求不完整，请重试", tone: "warn" },
};

function EmptyState({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="mx-auto max-w-[720px] px-5 pb-24 pt-32">
      <div className="rounded-2xl border border-line bg-paper px-8 py-12 text-center">
        <p className="font-serif text-xl text-forest">
          {loggedIn ? "还没有教材" : "登录后即可阅读教材"}
        </p>
        <p className="mt-3 text-sm leading-7 text-muted">
          {loggedIn
            ? "先在后台确认目录，再导入第一节内容，这里就会出现。"
            : "教材和学习进度是私人内容，需要先登录。"}
        </p>
        <Link
          href="/dashboard/login"
          className="mt-6 inline-flex items-center rounded-full bg-forest px-6 py-2.5 text-sm text-paper transition hover:bg-ink"
        >
          {loggedIn ? "去后台" : "去登录"}
        </Link>
      </div>
    </div>
  );
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const [user, tree] = await Promise.all([getCurrentUser(), getBookTree()]);

  if (!tree) return <EmptyState loggedIn={!!user} />;

  const detail = await getSectionDetail(sp.section);
  if (!detail) return <EmptyState loggedIn={!!user} />;

  const msg = sp.msg ? MSG[sp.msg] : null;
  const pct = tree.totalSections ? Math.round((tree.completedSections / tree.totalSections) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-20 pt-24">
      {/* 顶部标题 */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">教材</p>
          <h1 className="mt-2 font-serif text-3xl text-forest">{tree.book.title}</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-muted">
            {tree.completedSections} / {tree.totalSections} 节
          </p>
          <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            msg.tone === "ok"
              ? "border-leaf/40 bg-leaf/10 text-forest"
              : "border-pollen/50 bg-pollen/10 text-ink"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* 左栏：目录树 */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            {tree.chapters.map((ch) => {
              const active = ch.sections.some((s) => s.slug === detail.slug);
              return (
                <details key={ch.id} open={active} className="group mb-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-forest transition hover:bg-mist/60 marker:hidden">
                    <span className="font-mono text-[11px] text-muted">
                      {String(ch.ordinal).padStart(2, "0")}
                    </span>
                    <span className="flex-1">{ch.title}</span>
                    <span className="text-xs text-muted">{ch.sections.length}</span>
                  </summary>
                  <ul className="mt-1 space-y-0.5 border-l border-line pl-3">
                    {ch.sections.map((s) => {
                      const cur = s.slug === detail.slug;
                      return (
                        <li key={s.id}>
                          <Link
                            href={`/book?section=${s.slug}`}
                            className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] leading-6 transition ${
                              cur
                                ? "bg-paper font-medium text-forest shadow-soft"
                                : "text-muted hover:bg-mist/50 hover:text-ink"
                            }`}
                          >
                            <span className="mt-0.5 w-3 shrink-0 font-mono text-[11px]">
                              {s.completed ? "✓" : s.stuck ? "!" : ""}
                            </span>
                            <span className="flex-1">{s.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </nav>
        </aside>

        {/* 右栏：正文 */}
        <article className="min-w-0">
          <header className="mb-8">
            <p className="text-xs text-muted">
              {detail.chapterTitle} · 第 {detail.ordinal} 节 · 约 {detail.est_minutes} 分钟
            </p>
            <h2 className="mt-2 font-serif text-3xl leading-snug text-forest">{detail.title}</h2>
            {detail.progress?.status === "completed" &&
              detail.progress.completed_content_version !== detail.content_version && (
                <p className="mt-3 rounded-lg border border-pollen/50 bg-pollen/10 px-3 py-2 text-xs text-ink">
                  你学的是旧版内容，教材已更新，建议重读一遍。
                </p>
              )}
          </header>

          {/* 本节目标 */}
          {detail.goals.length > 0 && (
            <section className="mb-8 rounded-2xl border border-line bg-paper px-6 py-5">
              <h3 className="mb-3 text-sm font-medium text-forest">本节目标</h3>
              <ul className="space-y-2">
                {detail.goals.map((g, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-7 text-ink">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 正文 */}
          <MarkdownViewer content={detail.body_md} />

          {/* 知识点 */}
          {detail.key_points.length > 0 && (
            <section className="mt-10 border-t border-line pt-8">
              <h3 className="mb-4 font-serif text-xl text-forest">知识点清单</h3>
              <ul className="space-y-2">
                {detail.key_points.map((k, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-7 text-ink">
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 例子 */}
          {detail.examples.length > 0 && (
            <section className="mt-10 border-t border-line pt-8">
              <h3 className="mb-4 font-serif text-xl text-forest">例子</h3>
              <div className="space-y-5">
                {detail.examples.map((ex, i) => (
                  <div key={i} className="rounded-xl border border-line bg-paper px-5 py-4">
                    <p className="mb-3 text-sm font-medium text-forest">
                      {ex.title}
                      {ex.runnable && (
                        <span className="ml-2 rounded bg-leaf/15 px-1.5 py-0.5 text-[11px] text-forest">
                          可直接编译
                        </span>
                      )}
                    </p>
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

          {/* 练习 */}
          {detail.exercises.length > 0 && (
            <section className="mt-10 border-t border-line pt-8">
              <h3 className="mb-4 font-serif text-xl text-forest">练习</h3>
              <div className="space-y-3">
                {detail.exercises.map((ex, i) => (
                  <details key={i} className="group rounded-xl border border-line bg-paper px-5 py-4">
                    <summary className="cursor-pointer list-none text-sm leading-7 text-ink marker:hidden">
                      <span className="mr-2 font-mono text-xs text-muted">
                        练习 {i + 1}
                      </span>
                      {ex.prompt}
                      <span className="float-right text-xs text-muted group-open:hidden">看提示</span>
                    </summary>
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      {ex.hint && (
                        <p className="text-sm leading-7 text-muted">
                          <span className="mr-2 text-xs text-forest">提示</span>
                          {ex.hint}
                        </p>
                      )}
                      {ex.answer && (
                        <p className="text-sm leading-7 text-muted">
                          <span className="mr-2 text-xs text-forest">参考</span>
                          {ex.answer}
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* 验收判据 */}
          {detail.acceptance && (
            <section className="mt-10 rounded-2xl border-2 border-leaf/40 bg-leaf/5 px-6 py-5">
              <h3 className="mb-2 text-sm font-medium text-forest">验收判据</h3>
              <p className="text-sm leading-8 text-ink">{detail.acceptance}</p>
              <p className="mt-2 text-xs text-muted">
                能做到上面这条，才算这一节过了。做不到就点下面的「卡住了」，写一行卡在哪。
              </p>
            </section>
          )}

          {/* 操作区 */}
          <section className="mt-10 border-t border-line pt-8">
            <div className="flex flex-wrap items-center gap-3">
              <form action={saveProgress}>
                <input type="hidden" name="sectionId" value={detail.id} />
                <input type="hidden" name="slug" value={detail.slug} />
                <input type="hidden" name="contentVersion" value={detail.content_version} />
                <input type="hidden" name="action" value="complete" />
                <input type="hidden" name="back" value="/book" />
                <button
                  type="submit"
                  className="rounded-full bg-forest px-6 py-2.5 text-sm text-paper transition hover:bg-ink"
                >
                  {detail.progress?.status === "completed" ? "再确认一次：学完了" : "学完了"}
                </button>
              </form>

              <Link
                href={`/study/${detail.slug}`}
                className="rounded-full border border-line px-6 py-2.5 text-sm text-ink transition hover:border-forest hover:text-forest"
              >
                进入学习模式
              </Link>

              {detail.progress?.status === "completed" && (
                <form action={saveProgress}>
                  <input type="hidden" name="sectionId" value={detail.id} />
                  <input type="hidden" name="slug" value={detail.slug} />
                  <input type="hidden" name="action" value="reopen" />
                  <input type="hidden" name="back" value="/book" />
                  <button
                    type="submit"
                    className="rounded-full px-4 py-2.5 text-sm text-muted underline-offset-4 transition hover:text-ink hover:underline"
                  >
                    撤销完成
                  </button>
                </form>
              )}
            </div>

            {detail.progress?.status === "stuck" && detail.progress.stuck_note && (
              <div className="mt-4 rounded-xl border border-pollen/50 bg-pollen/10 px-4 py-3 text-sm leading-7 text-ink">
                <span className="mr-2 text-xs text-muted">上次卡在</span>
                {detail.progress.stuck_note}
              </div>
            )}

            <div className="mt-4">
              <form action={saveProgress} className="space-y-2">
                <input type="hidden" name="sectionId" value={detail.id} />
                <input type="hidden" name="slug" value={detail.slug} />
                <input type="hidden" name="action" value="stuck" />
                <input type="hidden" name="back" value="/book" />
                <input
                  name="note"
                  maxLength={200}
                  placeholder="卡住了？写一行卡在哪（必填）"
                  defaultValue={detail.progress?.stuck_note ?? ""}
                  className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-forest"
                />
                <button
                  type="submit"
                  className="rounded-full border border-line px-5 py-2 text-xs text-muted transition hover:border-forest hover:text-forest"
                >
                  记为「卡住了」
                </button>
              </form>
              {!user && (
                <p className="mt-3 text-xs text-muted">
                  未登录，按钮不会保存任何内容。
                  <Link href="/dashboard/login" className="ml-1 text-forest underline underline-offset-4">
                    去登录
                  </Link>
                </p>
              )}
            </div>
          </section>

          {/* 上下一节 */}
          <nav className="mt-12 flex items-stretch justify-between gap-4 border-t border-line pt-6">
            {detail.prev ? (
              <Link
                href={`/book?section=${detail.prev.slug}`}
                className="group max-w-[46%] rounded-xl border border-line px-4 py-3 transition hover:border-forest"
              >
                <span className="text-[11px] text-muted">上一节</span>
                <p className="mt-1 truncate text-sm text-ink group-hover:text-forest">
                  {detail.prev.title}
                </p>
              </Link>
            ) : (
              <span />
            )}
            {detail.next ? (
              <Link
                href={`/book?section=${detail.next.slug}`}
                className="group max-w-[46%] rounded-xl border border-line px-4 py-3 text-right transition hover:border-forest"
              >
                <span className="text-[11px] text-muted">下一节</span>
                <p className="mt-1 truncate text-sm text-ink group-hover:text-forest">
                  {detail.next.title}
                </p>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>
      </div>
    </div>
  );
}
