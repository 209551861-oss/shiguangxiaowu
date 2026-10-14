import Link from "next/link";
import Search from "@/components/ui/Search";
import ContentCard from "@/components/content/ContentCard";
import EmptyState from "@/components/content/EmptyState";
import PageHeader from "@/components/content/PageHeader";
import { searchSite } from "@/lib/services/content";
import { formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const results = q ? await searchSite(q) : [];

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-16">
      <PageHeader title="搜索" desc="在笔记、资料、作品、相册、瞬间与成长记录中检索。" />

      <div className="mb-10">
        <Search initialQuery={q} />
      </div>

      {!q ? (
        <EmptyState
          text="输入关键词，开始检索你的档案"
          hint="支持中文子串匹配，例如「学习」「摄影」「项目」。"
        />
      ) : results.length === 0 ? (
        <EmptyState
          text={`没有找到与「${q}」相关的内容`}
          hint="换个关键词试试，或去后台录入并设为「公开」。"
        />
      ) : (
        <>
          <p className="mb-6 text-sm text-muted">
            找到 <b className="text-leaf">{results.length}</b> 条与「{q}」相关的内容
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <ContentCard
                key={`${r.type}-${r.id}`}
                href={r.href}
                title={r.title}
                desc={r.snippet}
                cover={r.cover}
                badge={r.typeLabel}
                meta={formatDate(r.date)}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-14 text-center">
        <Link
          href="/"
          className="text-sm text-leaf transition hover:underline"
        >
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}
