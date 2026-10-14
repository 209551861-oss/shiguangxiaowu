"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MODULE_CONFIGS } from "@/lib/content-config";
import { formatDate } from "@/utils/format";

const DATE_KEYS = ["created_at", "published_at", "happened_at", "taken_at", "updated_at"];

export default function ContentList({ module }: { module: string }) {
  const cfg = MODULE_CONFIGS[module];
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from(cfg.table)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) alert(error.message);
    setRows((data as Record<string, unknown>[]) ?? []);
    setLoading(false);
  }

  async function remove(id: string) {
    if (!confirm(`确认删除这条${cfg.singular}？此操作不可撤销。`)) return;
    const supabase = createClient();
    const { error } = await supabase.from(cfg.table).delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  function cell(colKey: string, val: unknown) {
    if (colKey === "visibility") {
      const map: Record<string, [string, string]> = {
        public: ["公开", "bg-leaf/20 text-forest"],
        private: ["私密", "bg-bloom/40 text-forest"],
        draft: ["草稿", "bg-line text-muted"],
      };
      const [t, c] = map[String(val)] ?? [String(val), "bg-line text-muted"];
      return (
        <span className={`rounded-pill px-2 py-0.5 text-xs ${c}`}>{t}</span>
      );
    }
    if (DATE_KEYS.includes(colKey)) {
      return <span className="text-muted">{formatDate(val as string)}</span>;
    }
    if (colKey === "content") {
      return (
        <span className="block max-w-[320px] truncate text-muted">
          {(val as string) || "—"}
        </span>
      );
    }
    if (!val && val !== 0) return <span className="text-muted">—</span>;
    return <span className="truncate">{String(val)}</span>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-forest">
            {cfg.icon} {cfg.label}
          </h1>
          <p className="mt-1 text-sm text-muted">
            共 {rows.length} 条{cfg.singular}
          </p>
        </div>
        <Link
          href={`/dashboard/${module}/new`}
          className="rounded-pill bg-pollen px-5 py-2 text-sm text-forest shadow-press transition hover:-translate-y-0.5"
        >
          + 新建{cfg.singular}
        </Link>
      </div>

      <div className="glass mt-6 overflow-hidden rounded-2xl shadow-soft">
        {loading ? (
          <p className="p-8 text-center text-muted">加载中…</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-muted">
            还没有{cfg.singular}，点击右上角「新建」开始录入。
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                {cfg.listColumns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id as string} className="border-b border-line/60 last:border-0">
                  {cfg.listColumns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {cell(c.key, r[c.key])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/${module}/${r.id as string}`}
                      className="rounded-pill bg-leaf/15 px-3 py-1.5 text-xs text-forest transition hover:bg-leaf/25"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => remove(r.id as string)}
                      className="ml-2 rounded-pill bg-bloom/30 px-3 py-1.5 text-xs text-forest transition hover:bg-bloom/50"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
