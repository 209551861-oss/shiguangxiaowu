import Link from "next/link";
import { requireReciteOwner } from "@/lib/recite/guard";
import { listItems, todaySummary } from "@/lib/services/recite";
import { createItemAction } from "./actions";
import { formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function ReciteHomePage() {
  const { user } = await requireReciteOwner();
  const [summary, recent] = await Promise.all([
    todaySummary(user.id),
    listItems({}),
  ]);

  const { counts, settings, first } = summary;
  const nothingDue = counts.totalDue === 0;

  const cards = [
    {
      key: "overdue",
      label: "逾期",
      value: counts.overdue,
      hint: counts.overdue > 0 ? "先清这批，越拖越重" : "没有积压",
      tone: counts.overdue > 0 ? "warn" : "calm",
    },
    {
      key: "today",
      label: "今日到期",
      value: counts.today,
      hint: "按到期时间排序",
      tone: "calm",
    },
    {
      key: "new",
      label: "今日新卡",
      value: counts.newCards,
      hint: settings.auto_new_enabled
        ? `每日上限 ${settings.daily_new_limit} 张`
        : "自动新增已关闭",
      tone: "calm",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line bg-paper p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm text-muted">今天要复习</p>
            <p className="mt-1 font-serif text-4xl text-forest">
              {counts.totalDue}
              <span className="ml-1 text-base text-muted">张</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              已复习 {counts.reviewedToday} 张 ·{" "}
              {nothingDue ? "今天的任务已经清空" : "做完这批就收工，不用一次做完"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {nothingDue ? (
              <span className="rounded-pill bg-mist px-6 py-2.5 text-sm text-muted">
                今日无到期
              </span>
            ) : (
              <Link
                href="/recite/review"
                className="rounded-pill bg-forest px-7 py-2.5 text-sm text-paper shadow-press transition hover:-translate-y-0.5 hover:bg-ink"
              >
                开始复习 →
              </Link>
            )}
            {first && (
              <span className="text-xs text-muted">
                第一张属于「{first.bucket === "new" ? "新卡" : first.bucket === "overdue" ? "逾期" : "今日到期"}」
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.key}
              className={`rounded-2xl border p-4 ${
                c.tone === "warn"
                  ? "border-[#e3b7a8] bg-[#fdf1ec]"
                  : "border-line bg-mist/60"
              }`}
            >
              <p className="text-xs text-muted">{c.label}</p>
              <p className="mt-1 font-serif text-2xl text-forest">{c.value}</p>
              <p className="mt-1 text-xs text-muted">{c.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-serif text-lg text-forest">新的知识</h2>
          <p className="mt-1 text-sm text-muted">
            问答卡片背两面；笔记写整篇，之后从里面挑段落拆成复习单元。
          </p>
          <div className="mt-4 flex gap-2">
            <form action={createItemAction}>
              <input type="hidden" name="type" value="qa" />
              <button className="rounded-pill bg-pollen px-5 py-2 text-sm text-forest shadow-press transition hover:-translate-y-0.5">
                新建问答
              </button>
            </form>
            <form action={createItemAction}>
              <input type="hidden" name="type" value="note" />
              <button className="rounded-pill border border-line bg-paper px-5 py-2 text-sm text-forest transition hover:bg-leaf/10">
                新建笔记
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-serif text-lg text-forest">最近整理</h2>
          {recent.length === 0 ? (
            <p className="mt-2 text-sm text-muted">还没有内容，从上面开始。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/recite/item/${item.id}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl px-2 py-1.5 transition hover:bg-leaf/10"
                  >
                    <span className="truncate text-sm text-ink">{item.title}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {item.type === "qa" ? "问答" : "笔记"} · {item.unit_count} 单元
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <Link href="/recite/library" className="text-leaf hover:text-forest">
              进入知识库 →
            </Link>
            <span>更新于 {formatDate(recent[0]?.updated_at) || "—"}</span>
          </div>
        </div>
      </section>

      <p className="text-xs leading-6 text-muted">
        复习量是软性的：到期多少就显示多少，不会替你砍掉。做不完随时退出，已经评过的记下来，
        没评的下次还在。今天没做完也不会把卡片状态重置。
      </p>
    </div>
  );
}
