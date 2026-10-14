"use client";

import { useParams } from "next/navigation";
import ContentList from "@/components/dashboard/ContentList";
import { MODULE_CONFIGS } from "@/lib/content-config";

export default function ModuleListPage() {
  const params = useParams();
  const module = params.module as string;
  if (!MODULE_CONFIGS[module]) {
    return <p className="text-muted">未知模块：{module}</p>;
  }
  return <ContentList module={module} />;
}
