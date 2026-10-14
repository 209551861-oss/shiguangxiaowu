"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 搜索胶囊（浅色玻璃）。提交后跳转到 /search?q=… */
export default function Search({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const router = useRouter();

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <form
      onSubmit={go}
      className="glass-strong mx-auto flex max-w-[560px] items-center gap-2 rounded-pill p-3 shadow-soft"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索笔记、资料、作品、瞬间…"
        className="flex-1 border-none bg-transparent px-4 text-[15px] text-ink outline-none placeholder:text-muted"
      />
      <button
        type="submit"
        className="rounded-pill bg-leaf px-6 py-2.5 text-sm text-white transition hover:-translate-y-0.5 hover:bg-forest"
      >
        搜索
      </button>
    </form>
  );
}
