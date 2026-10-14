import Link from "next/link";
import { getArticleBySlug } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import MarkdownViewer from "@/components/MarkdownViewer";
import EmptyState from "@/components/content/EmptyState";
import type { Article } from "@/types";

export default async function ArticleDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug<Article>(
    slug,
    "id,title,slug,content,cover_url,published_at,created_at"
  );

  if (!article) {
    return (
      <div className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
        <EmptyState
          text="这篇文章不存在，或已被设为私密。"
          hint="返回文章列表看看其他文章吧。"
        />
        <div className="mt-6 text-center">
          <Link href="/articles" className="text-sm text-leaf hover:underline">
            ← 返回文章
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
      <Link href="/articles" className="text-sm text-muted hover:text-forest">
        ← 文章
      </Link>
      <h1 className="mt-4 font-serif text-4xl leading-tight text-forest">
        {article.title}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {formatDate(article.published_at) || formatDate(article.created_at)}
      </p>
      {article.cover_url && (
        <div className="mt-6 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.cover_url}
            alt={article.title}
            className="w-full object-cover"
          />
        </div>
      )}
      {article.content && (
        <div className="mt-8">
          <MarkdownViewer content={article.content} />
        </div>
      )}
    </article>
  );
}
