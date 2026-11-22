import Link from "next/link";
import { requireReciteOwner } from "@/lib/recite/guard";
import { listItems, listTags } from "@/lib/services/recite";
import { createItemAction } from "../actions";
import { formatDate } from "@/utils/format";
import type { ItemType } from "@/lib/services/recite";

export const dynamic = "force-dynamic";

const TYPE_TABS: { key: ItemType | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "qa", label: "问答" },
  { key: "note", label: "笔记" },
];

function excerpt(item: { type: ItemType; question_md: string | null; body_md: string | null; answer_md: string | null }) {
  const raw = item.type === "qa" ? item.question_md || item.answer_md : item.body_md;
  if (!raw) return "还没有内容";
  return raw
    .replace(/```[\s\S]*?```/g, " [代码] ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " [图片] ")
    .replace(/[#>*`_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; tag?: string }>;
}) {
  await requireReciteOwner("/recite/library");
  const sp = await searchParams;
  const type = (sp.type === "qa" || sp.type === "note" ? sp.type : "all") as ItemType | "all";
  const q = (sp.q ?? "").trim();
  const tag = (sp.tag ?? "").trim();

  const [items, tags] = await Promise.all([
    listItems({ type, q, tag: tag || undefined }),
    listTags(),
  ]);

  const buildHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const base = { type: type === "all" ? undefined : type, q: q || undefined, tag: tag || undefined, ...patch };
    Object.entries(base).forEach(([k, v]) => {
      if (v) next.set(k, v);
    });
    const qs = next.toString();
    return `/recite/library${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-pill bg-paper p-1 shadow-soft ring-1 ring-line">
          {TYPE_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={buildHref({ type: tab.key === "all" ? undefined : tab.key })}
              className={`rounded-pill px-4 py-1.5 text-sm transition ${
                type === tab.key ? "bg-forest text-paper" : "text-ink hover:bg-leaf/15"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <form action="/recite/library" className="flex items-center gap-2">
            {type !== "all" && <input type="hidden" name="type" value={type} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="搜标题或正文"
              className="w-48 rounded-pill border border-line bg-paper px-4 py-1.5 text-sm outline-none placeholder:text-muted focus:border-leaf"
            />
            <button className="rounded-pill border border-line bg-paper px-4 py-1.5 text-sm text-forest hover:bg-leaf/10">
              搜索
            </button>
          </form>
          <form action={createItemAction}>
            <input type="hidden" name="type" value="qa" />
            <button className="rounded-pill bg-pollen px-5 py-1.5 text-sm text-forest shadow-press transition hover:-translate-y-0.5">
              新建问答
            </button>
          </form>
          <form action={createItemAction}>
            <input type="hidden" name="type" value="note" />
            <button className="rounded-pill border border-line bg-paper px-5 py-1.5 text-sm text-forest transition hover:bg-leaf/10">
              新建笔记
            </button>
          </form>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">标签</span>
          {tag && (
            <Link href={buildHref({ tag: undefined })} className="rounded-pill bg-forest px-2.5 py-1 text-paper">
              {tag} ✕
            </Link>
          )}
          {tags
            .filter((t) => t.tag !== tag)
            .slice(0, 12)
            .map((t) => (
              <Link
                key={t.tag}
                href={buildHref({ tag: t.tag })}
                className="rounded-pill border border-line bg-paper px-2.5 py-1 text-ink hover:bg-leaf/10"
              >
                #{t.tag} <span className="text-muted">{t.count}</span>
              </Link>
            ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-3xl border border-line bg-paper px-8 py-14 text-center">
          <p className="font-serif text-lg text-forest">
            {q || tag ? "没有匹配的内容" : "还没有任何知识内容"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {q || tag ? "换个关键词，或清掉筛选条件。" : "先建一张问答卡片试试，或者写一篇笔记再拆成复习单元。"}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/recite/item/${item.id}`}
                className="block rounded-2xl border border-line bg-paper p-4 transition hover:border-leaf hover:shadow-soft"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                        item.type === "qa" ? "bg-pollen/60 text-forest" : "bg-leaf/15 text-forest"
                      }`}
                    >
                      {item.type === "qa" ? "问答" : "笔记"}
                    </span>
                    <span className="font-serif text-base text-forest">{item.title}</span>
                  </div>
                  <span className="text-xs text-muted">
                    {item.unit_count > 0 ? `${item.unit_count} 个复习单元` : "未拆复习单元"} ·{" "}
                    {formatDate(item.updated_at)}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">{excerpt(item)}</p>
                {(item.tags?.length > 0 || item.category) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
                    {item.category && (
                      <span className="rounded-full bg-mist px-2 py-0.5">{item.category}</span>
                    )}
                    {item.tags?.map((t: string) => (
                      <span key={t} className="rounded-full bg-mist px-2 py-0.5">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        搜索目前只匹配标题与正文原文。分类是单层的，标签可以多个。
      </p>
    </div>
  );
}
