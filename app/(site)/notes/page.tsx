import { getPublicList, getCategories, type CategoryItem } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import PageHeader from "@/components/content/PageHeader";
import ContentCard from "@/components/content/ContentCard";
import EmptyState from "@/components/content/EmptyState";
import CategoryFilter from "@/components/content/CategoryFilter";
import ModuleSearch from "@/components/content/ModuleSearch";
import type { Note } from "@/types";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const activeSlug = sp.cat?.trim();
  const q = sp.q?.trim() ?? "";

  const categories = await getCategories("notes");
  const active = categories.find((c) => c.slug === activeSlug);
  const catName = new Map<string, string>(categories.map((c: CategoryItem) => [c.id, c.name]));

  const notes = await getPublicList<Note>({
    table: "notes",
    select: "id,title,summary,cover_url,category_id,created_at",
    limit: 60,
    eq: active ? { category_id: active.id } : undefined,
    search: q ? { term: q, columns: ["title", "summary", "content"] } : undefined,
  });

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-12 pt-20">
      <PageHeader
        title="学习档案"
        desc="课程、读书、技术笔记的分类沉淀。支持公开与私密，Markdown 书写。"
        count={notes.length}
      />
      <ModuleSearch
        basePath="/notes"
        cat={activeSlug}
        q={q}
        placeholder="搜索笔记标题、摘要或正文…"
      />
      <CategoryFilter categories={categories} activeSlug={activeSlug} basePath="/notes" />
      {notes.length === 0 ? (
        q ? (
          <EmptyState
            text={`没有找到与「${q}」相关的笔记`}
            hint="换个关键词试试，或点上方「清除」查看全部档案。"
          />
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <ContentCard
              key={n.id}
              href={`/notes/${n.id}`}
              cover={n.cover_url ?? undefined}
              title={n.title}
              desc={n.summary ?? ""}
              badge={n.category_id ? (catName.get(n.category_id) ?? undefined) : undefined}
              meta={formatDate(n.created_at)}
            />
          ))}
        </div>
      )}
    </div>
  );
}