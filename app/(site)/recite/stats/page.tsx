import { requireReciteOwner } from "@/lib/recite/guard";
import { getSettings, getStats } from "@/lib/services/recite";
import { saveSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { user } = await requireReciteOwner("/recite/stats");
  const sp = await searchParams;
  const [stats, settings] = await Promise.all([getStats(user.id), getSettings(user.id)]);

  const max = Math.max(1, ...stats.trend.map((t) => t.count));

  const cards = [
    { label: "今日已复习", value: stats.reviewedToday, hint: "正式复习次数" },
    { label: "近 7 日复习", value: stats.reviews7d, hint: "含逾期补做" },
    { label: "待复习", value: stats.overdue + stats.dueToday, hint: `逾期 ${stats.overdue} · 今日到期 ${stats.dueToday}` },
    { label: "已掌握", value: stats.matureUnits, hint: "复习中且间隔 ≥ 21 天" },
    { label: "学习中", value: stats.learningUnits, hint: "已开始但未稳" },
    { label: "未开始", value: stats.newUnits, hint: "新卡，还没评过" },
  ];

  return (
    <div className="space-y-5">
      {sp.saved && <p className="text-xs text-leaf">设置已保存</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-paper p-4">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 font-serif text-2xl text-forest">{c.value}</p>
            <p className="mt-1 text-[11px] text-muted">{c.hint}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-line bg-paper p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-base text-forest">近 14 天复习量</h2>
          <span className="text-xs text-muted">7 天内遗忘 {stats.lapses7d} 次（评价「重来」）</span>
        </div>
        <div className="mt-4 flex h-32 items-end gap-1.5">
          {stats.trend.map((t) => (
            <div key={t.day} className="group flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-muted opacity-0 transition group-hover:opacity-100">
                {t.count}
              </span>
              <div
                className="w-full rounded-t bg-leaf/70 transition group-hover:bg-forest"
                style={{ height: `${Math.max(2, Math.round((t.count / max) * 100))}%` }}
                title={`${t.day}：${t.count} 次`}
              />
              <span className="text-[10px] text-muted">{t.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-base text-forest">内容与单元</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between rounded-xl bg-mist/60 px-3 py-2">
            <dt className="text-muted">知识内容</dt>
            <dd className="text-ink">
              {stats.totalItems} 条（问答 {stats.qaItems} · 笔记 {stats.noteItems}）
            </dd>
          </div>
          <div className="flex justify-between rounded-xl bg-mist/60 px-3 py-2">
            <dt className="text-muted">复习单元</dt>
            <dd className="text-ink">{stats.totalUnits} 个</dd>
          </div>
          <div className="flex justify-between rounded-xl bg-mist/60 px-3 py-2">
            <dt className="text-muted">已暂停</dt>
            <dd className="text-ink">{stats.suspendedUnits} 个</dd>
          </div>
          <div className="flex justify-between rounded-xl bg-mist/60 px-3 py-2">
            <dt className="text-muted">说明</dt>
            <dd className="text-ink">一篇笔记可对应多个单元</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-base text-forest">复习设置</h2>
        <form action={saveSettingsAction} className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-muted">每天自动上新卡上限</span>
            <input
              type="number"
              name="daily_new_limit"
              min={0}
              max={500}
              defaultValue={settings.daily_new_limit}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-leaf"
            />
            <span className="mt-1 block text-[11px] text-muted">
              只约束「自动安排」的新卡。手动挑的额外卡片不受此限。
            </span>
          </label>
          <label className="block">
            <span className="text-xs text-muted">目标记忆保留率</span>
            <input
              type="number"
              step="0.01"
              min={0.7}
              max={0.99}
              name="desired_retention"
              defaultValue={settings.desired_retention}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-leaf"
            />
            <span className="mt-1 block text-[11px] text-muted">
              0.9 表示希望记住 90%。调高会更频繁，调低会更稀疏。
            </span>
          </label>
          <label className="block">
            <span className="text-xs text-muted">时区（决定「今天」的边界）</span>
            <input
              name="timezone"
              defaultValue={settings.timezone}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-leaf"
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-muted">
            <input
              type="checkbox"
              name="auto_new_enabled"
              defaultChecked={settings.auto_new_enabled}
              className="h-4 w-4 accent-[#394b3c]"
            />
            自动安排新卡
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-pill bg-forest px-7 py-2 text-sm text-paper shadow-press transition hover:-translate-y-0.5 hover:bg-ink">
              保存设置
            </button>
          </div>
        </form>
        <p className="mt-3 text-[11px] leading-6 text-muted">
          调度用的是 FSRS-6（ts-fsrs 6.x）。历史日志里记了调度器版本，将来换算法也能解释旧数据。
        </p>
      </section>
    </div>
  );
}
