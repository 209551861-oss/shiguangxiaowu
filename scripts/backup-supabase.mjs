/**
 * 备份 Supabase 现有数据到本地 JSON。
 *
 * 用法：node scripts/backup-supabase.mjs
 * 产出：backups/<YYYYMMDD-HHmmss>/<table>.json + manifest.json
 *
 * 只读，不做任何写操作。密钥从 .env.local 读取，不打印。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TABLES = [
  'profiles',
  'categories',
  'notes',
  'resources',
  'artworks',
  'artwork_files',
  'albums',
  'photos',
  'moments',
  'timeline_events',
  'articles',
  'settings',
];

function readEnv() {
  const file = path.join(ROOT, '.env.local');
  const text = fs.readFileSync(file, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const PAGE = 1000;

async function fetchAll(base, key, table) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const url = `${base}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${table}: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

const env = readEnv();
const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const outDir = path.join(ROOT, 'backups', stamp());
fs.mkdirSync(outDir, { recursive: true });

const manifest = {
  createdAt: new Date().toISOString(),
  projectHost: new URL(base).host,
  tables: {},
};

for (const table of TABLES) {
  try {
    const rows = await fetchAll(base, key, table);
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2), 'utf8');
    manifest.tables[table] = { rows: rows.length, ok: true };
    console.log(`  ${table.padEnd(16)} ${rows.length} 行`);
  } catch (err) {
    manifest.tables[table] = { ok: false, error: String(err.message || err) };
    console.log(`  ${table.padEnd(16)} 失败：${err.message || err}`);
  }
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const okCount = Object.values(manifest.tables).filter((t) => t.ok).length;
const totalRows = Object.values(manifest.tables).reduce((n, t) => n + (t.rows || 0), 0);
console.log(`\n备份完成：${okCount}/${TABLES.length} 张表，共 ${totalRows} 行`);
console.log(`目录：${path.relative(ROOT, outDir)}`);
