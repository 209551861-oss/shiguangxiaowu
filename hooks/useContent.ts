"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 通用内容查询 hook（占位）。
 * Phase 1 建表后启用；当前返回空数组，不会因缺少环境变量而报错。
 */
export function useContent<T = unknown>(table: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: rows, error: err } = await supabase
          .from(table)
          .select("*")
          .order("created_at", { ascending: false });
        if (!active) return;
        if (err) setError(err.message);
        else setData((rows as T[]) ?? []);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [table]);

  return { data, loading, error };
}
