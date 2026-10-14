"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ContentForm from "@/components/dashboard/ContentForm";
import { MODULE_CONFIGS } from "@/lib/content-config";
import { createClient } from "@/lib/supabase/client";

export default function ModuleEditPage() {
  const params = useParams();
  const module = params.module as string;
  const id = params.id as string;
  const [item, setItem] = useState<Record<string, unknown> | null | undefined>(
    undefined
  );

  useEffect(() => {
    if (!MODULE_CONFIGS[module]) return;
    const supabase = createClient();
    supabase
      .from(MODULE_CONFIGS[module].table)
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setItem((data as Record<string, unknown>) ?? null));
  }, [module, id]);

  if (!MODULE_CONFIGS[module]) {
    return <p className="text-muted">未知模块：{module}</p>;
  }
  if (item === undefined) return <p className="text-muted">加载中…</p>;
  if (item === null) return <p className="text-muted">未找到该内容。</p>;

  return <ContentForm module={module} initial={item} />;
}
