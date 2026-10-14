"use client";

import { useParams } from "next/navigation";
import ContentForm from "@/components/dashboard/ContentForm";
import { MODULE_CONFIGS } from "@/lib/content-config";

export default function ModuleNewPage() {
  const params = useParams();
  const module = params.module as string;
  if (!MODULE_CONFIGS[module]) {
    return <p className="text-muted">未知模块：{module}</p>;
  }
  return <ContentForm module={module} />;
}
