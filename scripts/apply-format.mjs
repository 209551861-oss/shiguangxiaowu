import { readFileSync, readdirSync } from "node:fs";
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

const WRITE = process.argv.includes("--write");
const env = loadEnv(".env.local");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const dir = "scripts/backup";
const backupFile = readdirSync(dir).sort().pop();
const backup = JSON.parse(readFileSync(`${dir}/${backupFile}`, "utf8"));
const byId = new Map(backup.map((n) => [n.id, n]));

const files = readdirSync("scripts/format").filter((f) => f.endsWith(".md"));
console.log(`待写入 ${files.length} 条，备份 ${backup.length} 条（${backupFile}）\n`);

let ok = 0;
const missing = [];

for (const f of files) {
  const id = f.replace(/\.md$/, "");
  const note = byId.get(id);
  if (!note) {
    missing.push(id);
    continue;
  }
  const content = readFileSync(`scripts/format/${f}`, "utf8").replace(/\r\n/g, "\n").trimEnd() + "\n";
  const oldLen = (note.content ?? "").length;
  const newLen = content.length;
  console.log(`✓ ${note.title}  ${oldLen} → ${newLen} 字`);

  if (WRITE) {
    const { error } = await db.from("notes").update({ content }).eq("id", id);
    if (error) {
      console.log("  写入失败:", error.message);
      process.exitCode = 1;
    } else {
      ok++;
    }
  }
}

if (missing.length) console.log("\n未匹配到笔记的 md：", missing.join(", "));
console.log(WRITE ? `\n已写入 ${ok} 条` : "\n（dry-run，没有写库；加 --write 才真正写入）");
