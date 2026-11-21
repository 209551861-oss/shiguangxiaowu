import { createClient } from "@/lib/supabase/server";

export type BookMeta = {
  id: string;
  subject: string;
  title: string;
  version: string;
  status: string;
};

export type SectionNode = {
  id: string;
  slug: string;
  ordinal: number;
  title: string;
  est_minutes: number;
  status: string;
  completed: boolean;
  stuck: boolean;
  isStale: boolean;
};

export type ChapterNode = {
  id: string;
  slug: string;
  ordinal: number;
  title: string;
  summary: string | null;
  sections: SectionNode[];
};

export type BookTree = {
  book: BookMeta;
  chapters: ChapterNode[];
  totalSections: number;
  completedSections: number;
};

export type SectionDetail = {
  id: string;
  slug: string;
  title: string;
  ordinal: number;
  body_md: string;
  goals: string[];
  key_points: string[];
  examples: { title: string; runnable?: boolean; code?: string }[];
  exercises: { prompt: string; hint?: string; answer?: string }[];
  acceptance: string | null;
  est_minutes: number;
  content_version: string;
  chapterTitle: string;
  chapterSlug: string;
  progress: { status: string; stuck_note: string | null; completed_content_version: string | null } | null;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

/** 教材总览：书 → 章 → 节，带本人完成状态。未登录时 RLS 返回空。 */
export async function getBookTree(): Promise<BookTree | null> {
  const supabase = await createClient();

  const { data: books } = await supabase
    .from("book")
    .select("id,subject,title,version,status")
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1);

  const book = books?.[0];
  if (!book) return null;

  const { data: chapters } = await supabase
    .from("chapter")
    .select("id,slug,ordinal,title,summary")
    .eq("book_id", book.id)
    .order("ordinal", { ascending: true });

  const chapterList = chapters ?? [];
  if (chapterList.length === 0) {
    return { book, chapters: [], totalSections: 0, completedSections: 0 };
  }

  const chapterIds = chapterList.map((c) => c.id);

  const [{ data: sections }, { data: progress }] = await Promise.all([
    supabase
      .from("section")
      .select("id,chapter_id,slug,ordinal,title,est_minutes,status,content_version")
      .in("chapter_id", chapterIds)
      .neq("status", "archived")
      .order("ordinal", { ascending: true }),
    supabase.from("section_progress").select("section_id,status,completed_content_version"),
  ]);

  const progressMap = new Map(
    (progress ?? []).map((p) => [p.section_id as string, p])
  );

  let total = 0;
  let done = 0;

  const tree: ChapterNode[] = chapterList.map((c) => {
    const list = (sections ?? [])
      .filter((s) => s.chapter_id === c.id)
      .map((s) => {
        const p = progressMap.get(s.id as string);
        total += 1;
        const completed = p?.status === "completed";
        if (completed) done += 1;
        return {
          id: s.id as string,
          slug: s.slug as string,
          ordinal: s.ordinal as number,
          title: s.title as string,
          est_minutes: (s.est_minutes as number) ?? 30,
          status: s.status as string,
          completed,
          stuck: p?.status === "stuck",
          isStale:
            completed && !!p?.completed_content_version &&
            p.completed_content_version !== s.content_version,
        };
      });
    return {
      id: c.id as string,
      slug: c.slug as string,
      ordinal: c.ordinal as number,
      title: c.title as string,
      summary: (c.summary as string) ?? null,
      sections: list,
    };
  });

  return { book, chapters: tree, totalSections: total, completedSections: done };
}

/** 单节详情 + 前后节导航 */
export async function getSectionDetail(slug?: string): Promise<SectionDetail | null> {
  const tree = await getBookTree();
  if (!tree) return null;

  const flat = tree.chapters.flatMap((c) =>
    c.sections.map((s) => ({ ...s, chapterTitle: c.title, chapterSlug: c.slug }))
  );
  if (flat.length === 0) return null;

  const idx = slug ? flat.findIndex((s) => s.slug === slug) : 0;
  const target = flat[idx === -1 ? 0 : idx];
  if (!target) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("section")
    .select(
      "id,slug,title,ordinal,body_md,goals,key_points,examples,exercises,acceptance,est_minutes,content_version"
    )
    .eq("id", target.id)
    .maybeSingle();

  if (!row) return null;

  const { data: prog } = await supabase
    .from("section_progress")
    .select("status,stuck_note,completed_content_version")
    .eq("section_id", target.id)
    .maybeSingle();

  const realIdx = idx === -1 ? 0 : idx;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    ordinal: row.ordinal,
    body_md: row.body_md ?? "",
    goals: (row.goals as string[]) ?? [],
    key_points: (row.key_points as string[]) ?? [],
    examples: (row.examples as SectionDetail["examples"]) ?? [],
    exercises: (row.exercises as SectionDetail["exercises"]) ?? [],
    acceptance: row.acceptance ?? null,
    est_minutes: row.est_minutes ?? 30,
    content_version: row.content_version,
    chapterTitle: target.chapterTitle,
    chapterSlug: target.chapterSlug,
    progress: prog ?? null,
    prev: realIdx > 0 ? { slug: flat[realIdx - 1].slug, title: flat[realIdx - 1].title } : null,
    next:
      realIdx < flat.length - 1
        ? { slug: flat[realIdx + 1].slug, title: flat[realIdx + 1].title }
        : null,
  };
}

/** 当前登录用户（用于决定能不能打勾） */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
