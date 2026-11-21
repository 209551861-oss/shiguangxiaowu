/**
 * 教材导入脚本
 *
 * 用法：
 *   node scripts/import-curriculum.mjs --subject c            # 实际导入
 *   node scripts/import-curriculum.mjs --subject c --dry-run  # 只报告将要做什么
 *
 * 规则（对应需求文档 §8）：
 *   1. 按 slug upsert，绝不用 ordinal 当身份
 *   2. 不碰 section_progress
 *   3. manifest 里没有的节 → 标 archived，不删除
 *   4. 内容变化 → 保留 section id 与进度，content_version 带上新 hash
 *   5. 同一 manifest 重复导入零副作用
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const SUBJECT = getArg('subject', 'c');
const DRY = hasFlag('dry-run');

function readEnv() {
  const file = path.join(ROOT, '.env.local');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnv();
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function rest(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${BASE}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

function loadManifest() {
  const dir = path.join(ROOT, 'curriculum', SUBJECT);
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const ch of manifest.chapters) {
    for (const s of ch.sections) {
      const f = path.join(dir, ch.slug, `${s.slug}.md`);
      if (!fs.existsSync(f)) throw new Error(`缺少正文文件：${path.relative(ROOT, f)}`);
      s.body_md = fs.readFileSync(f, 'utf8');
      const payload = [
        s.body_md,
        JSON.stringify(s.goals || []),
        JSON.stringify(s.key_points || []),
        JSON.stringify(s.examples || []),
        JSON.stringify(s.exercises || []),
        s.acceptance || '',
      ].join('\u0000');
      s.content_hash = sha(payload);
      s.content_version = `${manifest.version}-${s.content_hash.slice(0, 6)}`;
    }
  }
  return manifest;
}

/** 找本人 user_id：优先环境变量，否则取 profiles 第一条 */
async function resolveUserId() {
  if (env.UNYRA_OWNER_USER_ID) return env.UNYRA_OWNER_USER_ID;
  const rows = await rest('profiles?select=id&limit=1');
  if (!rows.length) throw new Error('profiles 为空，无法确定 user_id');
  return rows[0].id;
}

async function main() {
  const manifest = loadManifest();
  const userId = await resolveUserId();

  console.log(`科目 ${SUBJECT}｜${manifest.title}｜${manifest.chapters.length} 章 ${manifest.chapters.reduce((n, c) => n + c.sections.length, 0)} 节`);
  console.log(`归属用户 ${userId}`);
  if (DRY) console.log('【dry-run】只报告，不写入\n');

  // 1. book
  const existingBooks = await rest(
    `book?select=*&user_id=eq.${userId}&subject=eq.${SUBJECT}&version=eq.${manifest.version}`
  );
  let book = existingBooks[0];
  if (!book) {
    if (DRY) {
      console.log(`+ 新建 book：${manifest.title} (${manifest.version})`);
    } else {
      const inserted = await rest('book', {
        method: 'POST',
        body: [{ user_id: userId, subject: SUBJECT, title: manifest.title, version: manifest.version, status: 'published', outline_version: manifest.version, outline_confirmed_at: new Date().toISOString() }],
        prefer: 'return=representation',
      });
      book = inserted[0];
      console.log(`+ 新建 book ${book.id}`);
    }
  } else {
    console.log(`= book 已存在 ${book.id}（状态 ${book.status}）`);
  }
  const bookId = book?.id || 'DRY-BOOK';

  const stat = { chapterNew: 0, chapterUpd: 0, sectionNew: 0, sectionUpd: 0, sectionSame: 0, archived: 0 };
  const seenSectionSlugs = new Set();

  for (const ch of manifest.chapters) {
    // 2. chapter
    const found = book?.id
      ? await rest(`chapter?select=*&book_id=eq.${bookId}&slug=eq.${encodeURIComponent(ch.slug)}`)
      : [];
    let chapterId;
    if (!found.length) {
      stat.chapterNew++;
      if (DRY) {
        console.log(`  + 章 ${ch.ordinal}. ${ch.title} (${ch.slug})`);
        chapterId = `DRY-CH-${ch.slug}`;
      } else {
        const ins = await rest('chapter', {
          method: 'POST',
          body: [{ book_id: bookId, slug: ch.slug, ordinal: ch.ordinal, title: ch.title, summary: ch.summary || null }],
          prefer: 'return=representation',
        });
        chapterId = ins[0].id;
        console.log(`  + 章 ${ch.ordinal}. ${ch.title}`);
      }
    } else {
      const cur = found[0];
      chapterId = cur.id;
      const changed = cur.title !== ch.title || cur.ordinal !== ch.ordinal || (cur.summary || null) !== (ch.summary || null);
      if (changed) {
        stat.chapterUpd++;
        if (!DRY) {
          await rest(`chapter?id=eq.${chapterId}`, {
            method: 'PATCH',
            body: { title: ch.title, ordinal: ch.ordinal, summary: ch.summary || null },
          });
        }
        console.log(`  ~ 章 ${ch.ordinal}. ${ch.title}（有变化已更新）`);
      }
    }

    // 3. section
    const existing = book?.id
      ? await rest(`section?select=id,slug,content_hash,content_version,status&chapter_id=eq.${chapterId}`)
      : [];
    const bySlug = new Map(existing.map((r) => [r.slug, r]));

    for (const s of ch.sections) {
      seenSectionSlugs.add(s.slug);
      const cur = bySlug.get(s.slug);
      const row = {
        chapter_id: chapterId,
        slug: s.slug,
        ordinal: s.ordinal,
        title: s.title,
        body_md: s.body_md,
        goals: s.goals || [],
        key_points: s.key_points || [],
        examples: s.examples || [],
        exercises: s.exercises || [],
        acceptance: s.acceptance || null,
        est_minutes: s.est_minutes || 30,
        content_version: s.content_version,
        content_hash: s.content_hash,
        status: 'published',
      };

      if (!cur) {
        stat.sectionNew++;
        console.log(`    + ${s.slug.padEnd(32)} ${s.title}`);
        if (!DRY) {
          await rest('section', { method: 'POST', body: [row], prefer: 'return=minimal' });
        }
      } else if (cur.content_hash === s.content_hash && cur.status === 'published') {
        stat.sectionSame++;
      } else {
        stat.sectionUpd++;
        console.log(`    ~ ${s.slug.padEnd(32)} ${s.title}（${cur.content_version} → ${s.content_version}）`);
        if (!DRY) {
          await rest(`section?id=eq.${cur.id}`, { method: 'PATCH', body: row });
        }
      }
    }

    // 4. 本章里清单没有的节 → archived
    for (const [slug, r] of bySlug) {
      if (!seenSectionSlugs.has(slug) && r.status !== 'archived') {
        stat.archived++;
        console.log(`    - ${slug.padEnd(32)} 不在本次清单，标记 archived`);
        if (!DRY) {
          await rest(`section?id=eq.${r.id}`, { method: 'PATCH', body: { status: 'archived' } });
        }
      }
    }
  }

  console.log('\n汇总：');
  console.log(`  章  新增 ${stat.chapterNew} / 更新 ${stat.chapterUpd}`);
  console.log(`  节  新增 ${stat.sectionNew} / 更新 ${stat.sectionUpd} / 未变 ${stat.sectionSame} / 归档 ${stat.archived}`);
  console.log(`  section_progress 未触碰`);
  if (DRY) console.log('\n（dry-run 结束，未写入任何数据）');
}

main().catch((e) => {
  console.error('导入失败：', e.message);
  process.exit(1);
});
