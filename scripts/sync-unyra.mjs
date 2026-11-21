/**
 * 把归一资料推到线上站点（本机跑，桥在 127.0.0.1）
 *
 * 为什么需要它：线上站点在 Vercel，摸不到你本机的归一桥；
 * 但反过来"你本机主动推给线上"是通的。所以云端同步用这个脚本。
 *
 * 用法：
 *   node scripts/sync-unyra.mjs                      # 推到 NEXT_PUBLIC_SITE_URL
 *   node scripts/sync-unyra.mjs --site https://xxx   # 指定站点
 *   node scripts/sync-unyra.mjs --dry                # 只看清单不推送
 *
 * 读取：.env.local / .env.production 里的
 *   UNYRA_BRIDGE_URL、UNYRA_INGEST_SECRET、NEXT_PUBLIC_SITE_URL
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function loadEnv() {
  const env = {};
  for (const file of [".env.local", ".env.production", ".env"]) {
    const p = path.resolve(file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !(m[1] in env)) env[m[1]] = m[2];
    }
  }
  return env;
}

const env = loadEnv();
const args = process.argv.slice(2);
const siteArg = args.indexOf("--site");
const SITE = (siteArg >= 0 ? args[siteArg + 1] : env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
const BRIDGE = (env.UNYRA_BRIDGE_URL || "http://127.0.0.1:4399").replace(/\/+$/, "");
const SECRET = env.UNYRA_INGEST_SECRET || "";
const DRY = args.includes("--dry");

if (!DRY && (!SITE || !SECRET)) {
  console.error("缺少 NEXT_PUBLIC_SITE_URL 或 UNYRA_INGEST_SECRET（见 .env.local）");
  process.exit(1);
}

async function bridge(pathname) {
  const res = await fetch(`${BRIDGE}${pathname}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`归一桥 ${pathname} 返回 ${res.status}`);
  return res.json();
}

let docs;
try {
  const health = await bridge("/health");
  console.log(`桥：v${health.version} · ${health.docFiles} 份资料 · 向量模型 ${health.embedding?.model ?? "-"}`);
  docs = (await bridge("/unyra/docs")).items ?? [];
} catch (err) {
  console.error(`连不上归一桥（${BRIDGE}）：${err.message}`);
  console.error("本机请先双击 tools/unyra-bridge/启动归一桥.vbs");
  process.exit(1);
}

console.log(`待推送 ${docs.length} 份 → ${DRY ? "(dry run)" : SITE}`);

const summary = { added: 0, updated: 0, skipped: 0, failed: 0 };

for (const meta of docs) {
  if (DRY) {
    console.log(`  · ${meta.title}（${meta.chars} 字）`);
    continue;
  }
  try {
    const body = await bridge(`/unyra/doc?nodeId=${encodeURIComponent(meta.nodeId)}`);
    const markdown = body.markdown || "";
    const payload = {
      source: "unyra",
      externalId: meta.nodeId,
      goalId: meta.goalId ?? body.goalId ?? null,
      goalTitle: meta.goalTitle ?? body.goalTitle ?? null,
      title: meta.title || body.title,
      markdown,
      contentHash: crypto.createHash("sha256").update(markdown).digest("hex"),
      updatedAt: meta.updatedAt ?? body.updatedAt ?? null,
      chars: meta.chars ?? body.chars,
    };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");

    const res = await fetch(`${SITE}/api/library/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-unyra-signature": signature },
      body: raw,
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      summary.failed += 1;
      console.log(`  ✗ ${payload.title}：${data?.error?.message ?? res.status}`);
      continue;
    }
    if (data.skipped) {
      summary.skipped += 1;
      console.log(`  = ${payload.title}：内容未变，跳过`);
    } else {
      const existed = data.existed ? "更新" : "新增";
      if (data.existed) summary.updated += 1;
      else summary.added += 1;
      console.log(`  ✓ ${payload.title}：${existed} ${data.chunks} 段`);
    }
  } catch (err) {
    summary.failed += 1;
    console.log(`  ✗ ${meta.title}：${err.message}`);
  }
}

if (!DRY) {
  console.log(
    `\n完成：新增 ${summary.added} · 更新 ${summary.updated} · 跳过 ${summary.skipped} · 失败 ${summary.failed}`
  );
}
