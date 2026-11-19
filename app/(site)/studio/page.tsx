import Link from "next/link";
import PageHeader from "@/components/content/PageHeader";
import {
  STUDIO_STAGE,
  STUDIO_MODULE,
  SPHERE_LESSON,
  PENDING_LESSONS,
  lessonMinutes,
} from "@/lib/studio/curriculum";

export const metadata = {
  title: "画室 · 拾光小屋",
  description: "课程地图与练习清单：从几何体的明暗开始，一节课只解决一件事。",
};

const lesson = SPHERE_LESSON;

export default function StudioPage() {
  const total = lessonMinutes(lesson);

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-16 pt-20">
      <PageHeader
        title="画室"
        desc="按课程地图逐节推进：每节课只解决一件事，练完有明确的验收标准。教程、示范与练习都留在这里。"
      />

      {/* 今日目标 */}
      <section className="mb-4 rounded-2xl border border-line bg-paper p-6 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.24em] text-muted">今日目标</p>
            <h2 className="mt-2 font-serif text-2xl text-forest">{lesson.title}</h2>
            <p className="mt-2 max-w-[560px] text-sm leading-7 text-muted">
              {lesson.taskSummary}
            </p>
          </div>
          <Link
            href={`/studio/${lesson.slug}`}
            className="rounded-pill bg-pollen px-6 py-2.5 text-sm text-forest shadow-press transition hover:-translate-y-0.5"
          >
            继续这节课
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "主线阅读", value: lesson.minutes.main },
            { label: "跟练", value: lesson.minutes.aux },
            { label: "独立作业", value: lesson.minutes.independent },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-line bg-mist/60 px-4 py-3 text-center"
            >
              <b className="block font-serif text-xl text-forest">{m.value}</b>
              <span className="text-xs text-muted">{m.label} / 分钟</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-right text-xs text-muted">合计 {total} 分钟</p>
      </section>

      {/* 课程地图 */}
      <h2 className="mb-4 mt-12 font-serif text-xl text-forest">课程地图</h2>
      <section className="rounded-2xl border border-line bg-paper p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-pill bg-pollen/70 px-3 py-1 text-xs text-forest">
            {STUDIO_STAGE.code}
          </span>
          <h3 className="font-serif text-2xl text-forest">{STUDIO_STAGE.name}</h3>
        </div>
        <p className="mt-2 text-sm leading-7 text-muted">{STUDIO_STAGE.goal}</p>

        <div className="mt-6 border-l-2 border-line pl-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-pill border border-line px-2.5 py-0.5 text-xs text-muted">
              {STUDIO_MODULE.code}
            </span>
            <h4 className="font-serif text-lg text-forest">{STUDIO_MODULE.name}</h4>
          </div>
          <p className="mt-1 text-sm text-muted">{STUDIO_MODULE.goal}</p>

          <ul className="mt-4 space-y-2">
            <li className="rounded-xl border border-line bg-mist/50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs text-muted">{lesson.code}</span>
                  <Link
                    href={`/studio/${lesson.slug}`}
                    className="font-medium text-forest underline decoration-line underline-offset-4 transition hover:decoration-forest"
                  >
                    {lesson.title}
                  </Link>
                  <span className="rounded-pill bg-leaf/15 px-2.5 py-0.5 text-xs text-forest">
                    已发布
                  </span>
                </div>
                <span className="text-xs text-muted">
                  {lesson.minutes.main + lesson.minutes.aux + lesson.minutes.independent} 分钟 ·{" "}
                  {lesson.exercises.length} 个练习
                </span>
              </div>
            </li>

            {PENDING_LESSONS.map((p) => (
              <li
                key={p.code}
                className="rounded-xl border border-dashed border-line px-4 py-3 text-muted"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs">{p.code}</span>
                    <span className="text-sm">{p.title}</span>
                    <span className="rounded-pill border border-line px-2.5 py-0.5 text-xs">
                      待写
                    </span>
                  </div>
                  <span className="text-xs">正文还是空的</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 练习清单 */}
      <h2 className="mb-4 mt-12 font-serif text-xl text-forest">这节课的练习</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {lesson.exercises.map((ex) => (
          <div
            key={ex.code}
            className="flex flex-col rounded-2xl border border-line bg-paper p-5 shadow-soft"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-muted">{ex.code}</span>
              <span
                className={
                  ex.independent
                    ? "rounded-pill bg-bloom/50 px-2.5 py-0.5 text-xs text-forest"
                    : "rounded-pill bg-leaf/15 px-2.5 py-0.5 text-xs text-forest"
                }
              >
                {ex.typeLabel}
              </span>
            </div>
            <h3 className="mt-3 font-serif text-lg text-forest">{ex.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted">{ex.purpose}</p>

            <dl className="mt-4 space-y-2 text-xs leading-6">
              <div className="flex gap-2">
                <dt className="w-10 shrink-0 text-leaf">允许</dt>
                <dd className="text-muted">{ex.allowed.join("、")}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-10 shrink-0 text-[#a94f36]">禁止</dt>
                <dd className="text-muted">{ex.prohibited.join("、")}</dd>
              </div>
            </dl>

            <Link
              href={`/studio/${lesson.slug}#homework`}
              className="mt-5 self-start text-sm text-leaf underline decoration-line underline-offset-4 transition hover:text-forest hover:decoration-forest"
            >
              看作业要求 →
            </Link>
          </div>
        ))}
      </div>

      {/* 数据说明 */}
      <p className="mt-12 rounded-xl border border-dashed border-line px-5 py-4 text-xs leading-6 text-muted">
        画室是本地画板的学习档案：课程内容与本地「绘画学院」共用一套教材，作品的提交与版本记录仍保留在本地服务里。
        网站这边只做阅读与验收标准，方便随时翻看这一步该练什么。
      </p>
    </div>
  );
}
