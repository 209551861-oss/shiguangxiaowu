import Link from "next/link";
import Search from "@/components/ui/Search";
import Card from "@/components/ui/Card";
import GlassCard from "@/components/ui/GlassCard";
import PollenField from "@/components/PollenField";
import { MODULES } from "@/lib/constants";
import {
  getSiteMeta,
  getModuleCounts,
  getRecentMoments,
  getRecentTimeline,
} from "@/lib/services/site";
import { formatDate } from "@/utils/format";

export default async function HomePage() {
  // 服务端并行拉取：站点元信息 / 各模块公开数量 / 最近公开瞬间 / 最近时间轴节点
  const [meta, counts, recentMoments, recentEvents] = await Promise.all([
    getSiteMeta(),
    getModuleCounts(),
    getRecentMoments(4),
    getRecentTimeline(4),
  ]);

  return (
    <div className="relative">
      <PollenField />

      <div className="mx-auto max-w-[1080px] px-5 pb-10">
        {/* Hero */}
        <header className="pb-10 pt-20 text-center">
          <span className="inline-block rounded-pill border border-line bg-leaf/10 px-5 py-1.5 text-xs tracking-[0.34em] text-leaf">
            个人数字档案 · 自 2026
          </span>
          <h1 className="mt-6 font-serif text-5xl leading-tight text-forest sm:text-6xl">
            把光阴，<span className="text-leaf">拾</span>成光
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-9 text-muted">
            {meta.site_tagline}
          </p>
          <div className="mt-8">
            <Search />
          </div>
        </header>

        {/* 资料统计卡 */}
        <GlassCard className="mx-auto mt-10 flex max-w-[760px] flex-wrap items-center justify-center gap-6 p-6 sm:gap-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-olive to-lime font-serif text-3xl text-white shadow-press ring-4 ring-paper">
            拾
          </div>
          <div className="min-w-[220px] flex-1 text-center sm:text-left">
            <h3 className="font-serif text-xl text-forest">关于我</h3>
            <p className="mt-1 text-sm leading-7 text-muted">{meta.about}</p>
          </div>
          <div className="flex gap-7">
            <div className="text-center">
              <b className="block font-serif text-2xl text-leaf">{counts.notes}</b>
              <span className="text-xs text-muted">学习笔记</span>
            </div>
            <div className="text-center">
              <b className="block font-serif text-2xl text-olive">{counts.resources}</b>
              <span className="text-xs text-muted">资料库</span>
            </div>
            <div className="text-center">
              <b className="block font-serif text-2xl text-lime">{counts.moments}</b>
              <span className="text-xs text-muted">瞬间</span>
            </div>
          </div>
        </GlassCard>

        {/* 模块导览 */}
        <h2 className="mt-16 text-center font-serif text-2xl text-forest">
          档案馆导览
        </h2>
        <p className="mb-8 text-center text-sm tracking-[0.1em] text-muted">
          八个模块，覆盖记录与创作的每一面
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Card key={m.href} {...m} />
          ))}
        </div>

        {/* 时间轴高亮 */}
        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-forest">成长时间轴</h2>
              <p className="mt-1 text-sm text-muted">
                最近落下的几个节点，串起这段日子的轨迹。
              </p>
            </div>
            <Link
              href="/timeline"
              className="shrink-0 text-sm text-leaf transition hover:underline"
            >
              查看全部 →
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <GlassCard className="p-8 text-center text-sm text-muted">
              还没有公开的时间轴节点。去后台记下第一个吧～
            </GlassCard>
          ) : (
            <GlassCard className="p-6">
              <div className="relative pl-8">
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 left-[13px] top-2 w-px bg-line"
                />
                <div className="flex flex-col gap-6">
                  {recentEvents.map((e) => (
                    <div key={e.id} className="relative">
                      <span className="absolute -left-8 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-pollen text-sm text-forest shadow-press">
                        {e.icon || "◆"}
                      </span>
                      <time className="font-serif text-sm text-leaf">
                        {formatDate(e.happened_at)}
                      </time>
                      <h3 className="mt-0.5 font-serif text-lg text-forest">
                        {e.title}
                      </h3>
                      {e.description && (
                        <p className="mt-1 line-clamp-2 text-sm leading-7 text-muted">
                          {e.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          )}
        </section>

        {/* 最近瞬间 */}
        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-2xl text-forest">最近瞬间</h2>
            <Link
              href="/moments"
              className="text-sm text-leaf transition hover:underline"
            >
              查看全部 →
            </Link>
          </div>

          {recentMoments.length === 0 ? (
            <GlassCard className="p-8 text-center text-sm text-muted">
              还没有公开的瞬间。去后台记录第一条吧～
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recentMoments.map((m) => (
                <GlassCard key={m.id} className="p-5">
                  <p className="text-[15px] leading-8 text-forest">
                    {m.content || "（无文字）"}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                    <span>{formatDate(m.created_at)}</span>
                    {m.location && <span>· {m.location}</span>}
                    {m.mood && <span>· {m.mood}</span>}
                    {m.images && m.images.length > 0 && (
                      <span>· {m.images.length} 图</span>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </section>

        <div className="mt-14 text-center">
          <Link
            href="/dashboard"
            className="rounded-pill bg-pollen px-7 py-3 text-sm text-forest shadow-press transition hover:-translate-y-0.5"
          >
            进入后台管理 →
          </Link>
        </div>
      </div>
    </div>
  );
}