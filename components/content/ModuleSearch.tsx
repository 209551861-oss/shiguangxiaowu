import Link from "next/link";

/**
 * 模块内搜索框：纯服务端表单（GET），无需客户端 JS。
 * 提交到当前模块路径并保留分类参数；清空关键词回到纯分类视图。
 */
export default function ModuleSearch({
  basePath,
  cat,
  q,
  placeholder = "在模块内搜索…",
}: {
  basePath: string;
  cat?: string;
  q?: string;
  placeholder?: string;
}) {
  return (
    <form
      action={basePath}
      method="get"
      className="glass mb-4 flex max-w-[560px] items-center gap-2 rounded-pill p-2 shadow-soft"
    >
      {cat && <input type="hidden" name="cat" value={cat} />}
      <input
        type="search"
        name="q"
        defaultValue={q ?? ""}
        placeholder={placeholder}
        aria-label="模块内搜索"
        className="min-w-0 flex-1 border-none bg-transparent px-4 text-sm text-ink outline-none placeholder:text-muted"
      />
      <button
        type="submit"
        className="shrink-0 rounded-pill bg-leaf px-5 py-2 text-sm text-white transition hover:-translate-y-0.5 hover:bg-forest"
      >
        搜索
      </button>
      {q && (
        <Link
          href={cat ? `${basePath}?cat=${encodeURIComponent(cat)}` : basePath}
          className="shrink-0 px-2 text-xs text-muted transition hover:text-forest"
        >
          清除
        </Link>
      )}
    </form>
  );
}
