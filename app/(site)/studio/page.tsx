import Link from "next/link";
import PageHeader from "@/components/content/PageHeader";
import {
  STUDIO_STAGE,
  STUDIO_MODULES,
  STUDIO_LESSONS,
  lessonsOfModule,
  lessonMinutes,
  totalMinutes,
  firstLesson,
} from "@/lib/studio/curriculum";

export const metadata = {
  title: "画室 · 拾光小屋",
  description: "课程地图与练习清单：从工具与观察开始，一节课只解决一件事。",
};

export default function StudioPage() {
  const lesson = firstLesson();
  const totalHour = Math.round(totalMinutes() / 60);

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-16 pt-20">
      <PageHeader
        title="画室"
        desc="按课程地图逐节推进：每节课只解决一件事，练完有明确的验收标准。教程、示范与练习都留在这里。"
        count={STUDIO_LESSONS.length}
      />

      {/* 今日目标 */}
      {lesson && (
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
          <p className="mt-3 text-right text-xs text-muted">
            本节合计 {lessonMinutes(lesson)} 分钟 · 全课 {STUDIO_LESSONS.length} 节 / 约 {totalHour} 小时
          </p>
        </section>
      )}

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

        <div className="mt-6 space-y-8">
          {STUDIO_MODULES.map((m) => {
            const lessons = lessonsOfModule(m.code);
            return (
              <div key={m.code} className="border-l-2 border-line pl-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-pill border border-line px-2.5 py-0.5 text-xs text-muted">
                    {m.code}
                  </span>
                  <h4 className="font-serif text-lg text-forest">{m.name}</h4>
                  <span className="text-xs text-muted">{lessons.length} 节</span>
                </div>
                <p className="mt-1 text-sm leading-7 text-muted">{m.goal}</p>

                <ul className="mt-4 space-y-2">
                  {lessons.map((l) => (
                    <li
                      key={l.code}
                      className="rounded-xl border border-line bg-mist/50 px-4 py-3 transition hover:border-leaf"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-xs text-muted">{l.code}</span>
                          <Link
                            href={`/studio/${l.slug}`}
                            className="font-medium text-forest underline decoration-line underline-offset-4 transition hover:decoration-forest"
                          >
                            {l.title}
                          </Link>
                          <span className="rounded-pill bg-leaf/15 px-2.5 py-0.5 text-xs text-forest">
                            已发布
                          </span>
                        </div>
                        <span className="text-xs text-muted">
                          {lessonMinutes(l)} 分钟 · {l.exercises.length} 个练习
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-muted">{l.taskSummary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* 数据说明 */}
      <p className="mt-12 rounded-xl border border-dashed border-line px-5 py-4 text-xs leading-6 text-muted">
        画室是本地画板的学习档案：课程内容与本地「绘画学院」共用一套教材，作品的提交与版本记录仍保留在本地服务里。
        网站这边只做阅读与验收标准，方便随时翻看这一步该练什么。
      </p>
    </div>
  );
}
