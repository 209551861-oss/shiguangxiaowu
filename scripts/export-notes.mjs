import { readFileSync, writeFileSync } from "node:fs";
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await supabase
  .from("notes")
  .select("id,title,summary,content,visibility,created_at")
  .order("created_at", { ascending: true });

if (error) {
  console.log("ERROR:", error.message);
  process.exit(1);
}

writeFileSync("scripts/notes-export.json", JSON.stringify(data, null, 2), "utf8");
console.log("已导出", data.length, "条 → scripts/notes-export.json");
for (const n of data) {
  console.log(`${n.id.slice(0, 8)}  ${String(n.content ?? "").length.toString().padStart(5)}字  ${n.title}`);
}
