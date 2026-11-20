import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownViewer from "@/components/MarkdownViewer";
import SphereFigure from "@/components/studio/SphereFigure";
import {
  STUDIO_STAGE,
  STUDIO_LESSONS,
  getStudioLesson,
  getStudioModule,
  lessonMinutes,
  type StudioSection,
} from "@/lib/studio/curriculum";

export function generateStaticParams() {
  return STUDIO_LESSONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getStudioLesson(slug);
  if (!lesson) return { title: "找不到这节课 · 拾光小屋" };
  return {
    title: `${lesson.title} · 画室`,
    description: lesson.objective,
  };
}

function SectionBody({ section }: { section: StudioSection }) {
  return (
    <section id={section.key} className="scroll-mt-28 border-t border-line pt-8 first:border-0 first:pt-0">
      <h2 className="mb-3 font-serif text-2xl text-forest">
        <span className="mr-2 font-mono text-sm text-muted">{section.no}</span>
        {section.label}
      </h2>

      {section.figure === "sphere" && <SphereFigure />}

      {section.md && <MarkdownViewer content={section.md} />}

      {section.quiz && (
        <div className="mt-4 space-y-3">
          {section.quiz.map((item, i) => (
            <details
              key={item.q}
              className="group rounded-xl border border-line bg-paper px-5 py-4 transition open:shadow-soft"
            >
              <summary className="cursor-pointer list-none text-sm font-medium text-forest marker:hidden">
                <span className="mr-2 font-mono text-xs text-muted">Q{i + 1}</span>
                {item.q}
                <span className="float-right text-xs text-muted group-open:hidden">展开</span>
              </summary>
              <p className="mt-3 border-t border-line pt-3 text-sm leading-8 text-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getStudioLesson(slug);
  if (!lesson) notFound();
  const module = getStudioModule(lesson.moduleCode);
  const acceptanceSection = lesson.sections.find((s) => s.label.includes("验收"));

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-16 pt-20">
      {/* 面包屑 */}
      <nav className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link href="/studio" className="transition hover:text-forest">
          画室
        </Link>
        <span>/</span>
        <span>{STUDIO_STAGE.code} {STUDIO_STAGE.name}</span>
        <span>/</span>
        <span>{module ? `${module.code} ${module.name}` : lesson.moduleCode}</span>
        <span>/</span>
        <span className="text-ink">{lesson.unitName}</span>
      </nav>

      {/* 标题区 */}
      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted">{lesson.code}</span>
          <span className="rounded-pill bg-leaf/15 px-2.5 py-0.5 text-xs text-forest">
            已发布
          </span>
        </div>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-forest">{lesson.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          <span>主线 {lesson.minutes.main} 分钟</span>
          <span>跟练 {lesson.minutes.aux} 分钟</span>
          <span>独立 {lesson.minutes.independent} 分钟</span>
          <span>合计 {lessonMinutes(lesson)} 分钟</span>
          <span>{lesson.exercises.length} 个练习</span>
        </div>
      </header>

      {/* 移动端目录 */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {lesson.sections.map((s) => (
          <a
            key={s.key}
            href={`#${s.key}`}
            className="shrink-0 rounded-pill border border-line bg-paper px-3 py-1.5 text-xs text-muted"
          >
            {s.no} {s.label}
          </a>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[180px_minmax(0,1fr)_250px]">
        {/* 左目录 */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-3 text-xs tracking-[0.2em] text-muted">本节目录</p>
            <ol className="space-y-1.5 border-l border-line pl-3 text-sm">
              {lesson.sections.map((s) => (
                <li key={s.key}>
                  <a
                    href={`#${s.key}`}
                    className="block text-muted transition hover:text-forest"
                  >
                    <span className="mr-2 font-mono text-xs">{s.no}</span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* 正文 */}
        <article className="min-w-0 space-y-10">
          {lesson.sections.map((s) => (
            <SectionBody key={s.key} section={s} />
          ))}

          <div className="border-t border-line pt-8">
            <Link
              href="/studio"
              className="text-sm text-leaf underline decoration-line underline-offset-4 transition hover:text-forest hover:decoration-forest"
            >
              ← 回到课程地图
            </Link>
          </div>
        </article>

        {/* 右栏 */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
            <p className="text-xs tracking-[0.2em] text-muted">本节目标</p>
            <p className="mt-2 text-sm leading-7 text-ink">{lesson.objective}</p>
          </div>

          <div className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
            <p className="text-xs tracking-[0.2em] text-muted">前置</p>
            <p className="mt-2 text-sm leading-7 text-muted">{lesson.prerequisite}</p>
          </div>

          <div className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
            <p className="text-xs tracking-[0.2em] text-muted">验收标准</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              本节按「验收标准」逐条自查：达标条件是清单，不是分数。
            </p>
            {acceptanceSection && (
              <a
                href={`#${acceptanceSection.key}`}
                className="mt-3 inline-block text-xs text-leaf underline decoration-line underline-offset-4 hover:text-forest"
              >
                看完整验收标准
              </a>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
            <p className="text-xs tracking-[0.2em] text-muted">练习</p>
            <ul className="mt-2 space-y-2 text-sm">
              {lesson.exercises.map((ex) => (
                <li key={ex.code} className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted">{ex.code}</span>
                  <a
                    href="#homework"
                    className="text-ink underline decoration-line underline-offset-4 transition hover:text-forest hover:decoration-forest"
                  >
                    {ex.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
