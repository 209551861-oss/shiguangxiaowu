import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(".env.local");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await supabase
  .from("notes")
  .select("*")
  .order("created_at", { ascending: true });

if (error) {
  console.log("读取失败:", error.message);
  process.exit(1);
}

if (!existsSync("scripts/backup")) mkdirSync("scripts/backup", { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const path = `scripts/backup/notes-${stamp}.json`;
writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
console.log("备份", data.length, "条 →", path);

// 写权限探针：把第一条正文原样写回，确认 service role 能过 RLS
const probe = data[0];
const { error: werr } = await supabase
  .from("notes")
  .update({ content: probe.content })
  .eq("id", probe.id);
console.log("写权限探针:", werr ? "失败 → " + werr.message : "通过（service role 可写）");
