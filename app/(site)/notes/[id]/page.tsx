import Link from "next/link";
import { getPublicItem } from "@/lib/services/content";
import { formatDate } from "@/utils/format";
import MarkdownViewer from "@/components/MarkdownViewer";
import EmptyState from "@/components/content/EmptyState";
import type { Note } from "@/types";

export default async function NoteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await getPublicItem<Note>(
    "notes",
    id,
    "id,title,summary,content,cover_url,created_at"
  );

  if (!note) {
    return (
      <div className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
        <EmptyState
          text="这条笔记不存在，或已被设为私密。"
          hint="返回学习档案看看其他笔记吧。"
        />
        <div className="mt-6 text-center">
          <Link href="/notes" className="text-sm text-leaf hover:underline">
            ← 返回学习档案
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
      <Link href="/notes" className="text-sm text-muted hover:text-forest">
        ← 学习档案
      </Link>
      <h1 className="mt-4 font-serif text-4xl leading-tight text-forest">
        {note.title}
      </h1>
      <p className="mt-2 text-sm text-muted">{formatDate(note.created_at)}</p>
      {note.cover_url && (
        <div className="mt-6 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={note.cover_url}
            alt={note.title}
            className="w-full object-cover"
          />
        </div>
      )}
      {note.content && (
        <div className="mt-8">
          <MarkdownViewer content={note.content} />
        </div>
      )}
    </article>
  );
}
