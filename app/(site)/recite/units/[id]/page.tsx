import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReciteOwner } from "@/lib/recite/guard";
import { getItem, getUnit } from "@/lib/services/recite";
import { STATE_NAME } from "@/lib/recite/fsrs";
import { formatDate } from "@/utils/format";
import MarkdownEditor from "@/components/recite/MarkdownEditor";
import { deleteUnitAction, saveUnitAction, toggleUnitAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function UnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requireReciteOwner(`/recite/units/${id}`);

  const unit = await getUnit(id);
  if (!unit) notFound();

  const source = unit.source_item_id ? await getItem(unit.source_item_id) : null;
  const back = `/recite/units/${id}`;
  const sourceLabel =
    unit.source_type === "qa"
      ? "来自问答卡片"
      : unit.source_type === "note_selection"
        ? "从笔记里选出来的"
        : "手动创建";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={source ? `/recite/item/${source.id}` : "/recite/library"}
            className="text-sm text-muted hover:text-forest"
          >
            ← {source ? source.title : "知识库"}
          </Link>
          <span className="rounded-md bg-mist px-2 py-0.5 text-[11px] text-muted">{sourceLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {sp.created && <span className="text-leaf">已创建</span>}
          {sp.saved && <span className="text-leaf">已保存</span>}
          {sp.err && <span className="text-red-700">{sp.err}</span>}
          <span className="text-muted">
            {unit.review_enabled ? STATE_NAME[unit.state.fsrs_state] ?? "—" : "已暂停"} · 复习{" "}
            {unit.state.reps} 次
            {unit.state.lapses > 0 ? ` · 遗忘 ${unit.state.lapses} 次` : ""} ·{" "}
            {unit.state.reps === 0 ? "还没复习过" : `下次 ${formatDate(unit.state.due_at)}`}
          </span>
        </div>
      </div>

      <form action={saveUnitAction} className="space-y-4">
        <input type="hidden" name="id" value={unit.id} />

        <section>
          <p className="mb-2 text-xs tracking-wide text-muted">正面 · 问题 / 提示</p>
          <MarkdownEditor
            name="front_md"
            defaultValue={unit.front_md}
            unitId={unit.id}
            placeholder="看到这段，你要想起什么？"
            minHeight={140}
          />
        </section>

        <section>
          <p className="mb-2 text-xs tracking-wide text-muted">背面 · 答案</p>
          <MarkdownEditor
            name="back_md"
            defaultValue={unit.back_md}
            unitId={unit.id}
            placeholder="答案"
            minHeight={240}
          />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="review_enabled"
              defaultChecked={unit.review_enabled}
              className="h-4 w-4 accent-[#394b3c]"
            />
            参与每日复习（取消勾选＝暂停，历史记录保留）
          </label>
          <button className="rounded-pill bg-forest px-7 py-2 text-sm text-paper shadow-press transition hover:-translate-y-0.5 hover:bg-ink">
            保存
          </button>
        </div>
      </form>

      {unit.source_snapshot && unit.source_type === "note_selection" && (
        <details className="rounded-2xl border border-line bg-mist/60 p-4">
          <summary className="cursor-pointer text-sm text-muted">创建时从笔记里取的原文快照</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-ink">
            {unit.source_snapshot}
          </pre>
          <p className="mt-2 text-[11px] text-muted">
            笔记后来被改过也不会影响这张卡；这张卡改了也不会改笔记。
          </p>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form action={toggleUnitAction}>
          <input type="hidden" name="id" value={unit.id} />
          <input type="hidden" name="enabled" value={unit.review_enabled ? "0" : "1"} />
          <input type="hidden" name="back" value={back} />
          <button className="rounded-pill border border-line bg-paper px-4 py-1.5 text-sm text-forest hover:bg-leaf/10">
            {unit.review_enabled ? "暂停复习" : "恢复复习"}
          </button>
        </form>
        <form action={deleteUnitAction}>
          <input type="hidden" name="id" value={unit.id} />
          <input type="hidden" name="back" value={source ? `/recite/item/${source.id}` : "/recite/library"} />
          <button className="rounded-pill border border-[#e3b7a8] bg-[#fdf1ec] px-4 py-1.5 text-sm text-[#9c4a2f] hover:bg-[#fbe7df]">
            删除这张卡
          </button>
        </form>
        {source && (
          <Link
            href={`/recite/item/${source.id}`}
            className="rounded-pill border border-line bg-paper px-4 py-1.5 text-sm text-forest hover:bg-leaf/10"
          >
            回到来源笔记
          </Link>
        )}
      </div>
    </div>
  );
}
