import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReciteOwner } from "@/lib/recite/guard";
import { getItem, listAttachments, listUnitsByItem } from "@/lib/services/recite";
import { STATE_NAME } from "@/lib/recite/fsrs";
import { formatDate } from "@/utils/format";
import MarkdownEditor from "@/components/recite/MarkdownEditor";
import Prose from "@/components/recite/Prose";
import NoteSelection from "@/components/recite/NoteSelection";
import AttachmentUploader from "@/components/recite/AttachmentUploader";
import {
  deleteAttachmentAction,
  deleteItemAction,
  saveItemAction,
} from "../../actions";

export const dynamic = "force-dynamic";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; saved?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requireReciteOwner(`/recite/item/${id}`);

  const item = await getItem(id);
  if (!item) notFound();
  const [units, attachments] = await Promise.all([
    listUnitsByItem(id),
    listAttachments({ itemId: id }),
  ]);

  const isNote = item.type === "note";
  const hasBody = Boolean((item.body_md ?? "").trim());
  const mode = isNote ? (sp.mode === "edit" || !hasBody ? "edit" : "read") : "edit";
  const back = `/recite/item/${id}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/recite/library" className="text-sm text-muted hover:text-forest">
            ← 知识库
          </Link>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] ${
              item.type === "qa" ? "bg-pollen/60 text-forest" : "bg-leaf/15 text-forest"
            }`}
          >
            {item.type === "qa" ? "问答卡片" : "知识笔记"}
          </span>
          <span className="text-xs text-muted">更新于 {formatDate(item.updated_at)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {sp.saved && <span className="text-leaf">已保存</span>}
          {sp.err && <span className="text-red-700">{sp.err}</span>}
          {isNote && (
            <Link
              href={`${back}?mode=${mode === "edit" ? "read" : "edit"}`}
              className="rounded-pill border border-line bg-paper px-4 py-1.5 text-sm text-forest hover:bg-leaf/10"
            >
              {mode === "edit" ? "阅读 / 拆卡" : "编辑正文"}
            </Link>
          )}
        </div>
      </div>

      {mode === "read" ? (
        <article className="rounded-3xl border border-line bg-paper p-6">
          <h2 className="font-serif text-2xl text-forest">{item.title}</h2>
          <p className="mb-4 mt-1 text-xs text-muted">
            在正文里划选一段文字，可以直接把它变成一张复习卡。
          </p>
          <NoteSelection itemId={item.id}>
            <Prose content={item.body_md ?? ""} />
          </NoteSelection>
        </article>
      ) : (
        <form action={saveItemAction} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="type" value={item.type} />

          <div className="rounded-3xl border border-line bg-paper p-5">
            <input
              name="title"
              defaultValue={item.title}
              placeholder="标题"
              className="w-full border-b border-line bg-transparent pb-2 font-serif text-xl text-forest outline-none placeholder:text-muted focus:border-leaf"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs text-muted">
                分类
                <input
                  name="category"
                  defaultValue={item.category ?? ""}
                  placeholder="例如 C 语言"
                  className="w-32 rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-leaf"
                />
              </label>
              <label className="flex flex-1 items-center gap-2 text-xs text-muted">
                标签
                <input
                  name="tags"
                  defaultValue={(item.tags ?? []).join(", ")}
                  placeholder="用逗号分隔，例如 指针, 内存"
                  className="min-w-[180px] flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-leaf"
                />
              </label>
              {!isNote && (
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    name="review_enabled"
                    defaultChecked={item.review_enabled}
                    className="h-4 w-4 accent-[#394b3c]"
                  />
                  参与复习
                </label>
              )}
            </div>
          </div>

          {item.type === "qa" ? (
            <>
              <section>
                <p className="mb-2 text-xs tracking-wide text-muted">正面 · 问题</p>
                <MarkdownEditor
                  name="question_md"
                  defaultValue={item.question_md ?? ""}
                  itemId={item.id}
                  placeholder="要问什么？"
                  minHeight={140}
                />
              </section>
              <section>
                <p className="mb-2 text-xs tracking-wide text-muted">背面 · 答案</p>
                <MarkdownEditor
                  name="answer_md"
                  defaultValue={item.answer_md ?? ""}
                  itemId={item.id}
                  placeholder="答案、推导、例子…"
                  minHeight={220}
                />
              </section>
            </>
          ) : (
            <section>
              <MarkdownEditor
                name="body_md"
                defaultValue={item.body_md ?? ""}
                itemId={item.id}
                placeholder="写整篇笔记。保存后切到「阅读 / 拆卡」划选句子建卡。"
                minHeight={420}
              />
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              富文本与 Markdown 改的是同一份内容，切模式不丢格式（公式以源码形式保留）。
            </p>
            <button className="rounded-pill bg-forest px-7 py-2 text-sm text-paper shadow-press transition hover:-translate-y-0.5 hover:bg-ink">
              保存
            </button>
          </div>
        </form>
      )}

      {mode === "read" && (
        <div className="flex justify-end">
          <Link
            href={`${back}?mode=edit`}
            className="rounded-pill border border-line bg-paper px-4 py-1.5 text-sm text-forest hover:bg-leaf/10"
          >
            编辑正文
          </Link>
        </div>
      )}

      <section className="rounded-3xl border border-line bg-paper p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-base text-forest">关联复习单元</h3>
          <span className="text-xs text-muted">{units.length} 个</span>
        </div>
        {units.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {isNote
              ? "还没有复习单元。切到「阅读 / 拆卡」，划选一段文字就能建一张。"
              : "保存并勾选「参与复习」后会自动生成对应的复习单元。"}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {units.map((unit) => (
              <li key={unit.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <Link href={`/recite/units/${unit.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {unit.front_md.replace(/[#*`>\n]/g, " ").trim() || "（未写问题）"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {unit.back_md.replace(/[#*`>\n]/g, " ").trim().slice(0, 90)}
                  </p>
                </Link>
                <span className="shrink-0 text-xs text-muted">
                  {unit.review_enabled ? STATE_NAME[unit.state.fsrs_state] ?? "—" : "已暂停"} · 复习{" "}
                  {unit.state.reps} 次 ·{" "}
                  {unit.state.reps === 0 ? "未开始" : `下次 ${formatDate(unit.state.due_at)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-serif text-base text-forest">附件</h3>
          <AttachmentUploader itemId={item.id} />
        </div>
        {attachments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            还没有附件。图片可以直接插进正文（编辑器工具条的图片按钮），其它文件放这里。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {attachments.map((att) => (
              <li key={att.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <a
                    href={`/api/recite/file/${att.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm text-leaf underline decoration-dotted underline-offset-4 hover:text-forest"
                  >
                    {att.filename}
                  </a>
                  <span className="ml-2 text-[11px] text-muted">
                    {att.kind === "image" ? "图片" : att.mime.split("/")[1] || "文件"} ·{" "}
                    {humanSize(att.size)} · {formatDate(att.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <a
                    href={`/api/recite/file/${att.id}?download=1`}
                    className="text-muted hover:text-forest"
                  >
                    下载
                  </a>
                  <form action={deleteAttachmentAction}>
                    <input type="hidden" name="id" value={att.id} />
                    <input type="hidden" name="back" value={`${back}${mode === "read" ? "" : "?mode=edit"}`} />
                    <button className="text-muted hover:text-red-700">删除</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-2xl border border-line bg-mist/60 p-4">
        <summary className="cursor-pointer text-sm text-muted">删除这条内容</summary>
        <p className="mt-2 text-xs leading-6 text-muted">
          删除前请选择复习单元怎么处理。选「保留」的话，单元会脱离本笔记继续独立存在，复习记录不丢。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={deleteItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="mode" value="keep" />
            <button className="rounded-pill border border-line bg-paper px-4 py-1.5 text-sm text-ink hover:bg-leaf/10">
              删内容，保留复习单元
            </button>
          </form>
          <form action={deleteItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="mode" value="all" />
            <button className="rounded-pill border border-[#e3b7a8] bg-[#fdf1ec] px-4 py-1.5 text-sm text-[#9c4a2f] hover:bg-[#fbe7df]">
              连复习单元一起删
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
