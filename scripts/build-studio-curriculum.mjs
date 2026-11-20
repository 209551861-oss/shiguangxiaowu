/**
 * build-studio-curriculum.mjs — 把「绘画学院」课程包转成画室的静态数据。
 *
 *   node scripts/build-studio-curriculum.mjs <课程包目录>
 *   node scripts/build-studio-curriculum.mjs <课程包目录> --out lib/studio/curriculum-data.ts
 *
 * 课程包结构：course_manifest.json + lessons/*.md
 * 产物：lib/studio/curriculum-data.ts（STUDIO_STAGE / STUDIO_MODULES / STUDIO_LESSONS）
 *
 * 画室不连数据库，教材以静态数据落地，所以课程包更新后重跑这个脚本即可。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const dirArg = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const OUT = outIdx >= 0 ? args[outIdx + 1] : "lib/studio/curriculum-data.ts";

if (!dirArg) {
  console.error("用法：node scripts/build-studio-curriculum.mjs <课程包目录>");
  process.exit(1);
}
const DIR = resolve(dirArg);
const manifestPath = join(DIR, "course_manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`找不到 ${manifestPath}`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

/* ------------------------------------------------------------------ */
/* 解析                                                                */
/* ------------------------------------------------------------------ */

const pad2 = (n) => String(n).padStart(2, "0");

/** 按 ## 切小节，返回 [{label, no, md}] */
function splitSections(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (cur) out.push(cur);
      // 去掉「一、」「1.」这类序号前缀，序号单独存
      const raw = m[1].trim();
      const numbered = raw.match(/^([一二三四五六七八九十]+|\d+)[、.．]\s*(.+)$/);
      cur = { label: numbered ? numbered[2].trim() : raw, md: [] };
      continue;
    }
    if (cur) cur.md.push(line);
  }
  if (cur) out.push(cur);
  return out
    .map((s, i) => ({ ...s, no: pad2(i + 1), md: s.md.join("\n").trim() }))
    .filter((s) => s.md);
}

function sectionByLabel(sections, keyword) {
  return sections.find((s) => s.label.includes(keyword));
}

/** "- a\n- b" → ["a","b"] */
function bullets(md) {
  return (md || "")
    .split("\n")
    .map((l) => l.replace(/^\s*[-*]\s+/, "").trim())
    .filter((l) => l && !l.startsWith("#"));
}

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

/* ------------------------------------------------------------------ */
/* 组装                                                                */
/* ------------------------------------------------------------------ */

const modules = manifest.modules.map((m, i) => ({
  code: m.id,
  name: m.name,
  ordinal: i + 1,
  goal: m.goal || "",
}));

const lessons = manifest.lessons.map((l, idx) => {
  const file = join(DIR, "lessons", l.file);
  if (!existsSync(file)) throw new Error(`缺少课程文件：${file}`);
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const body = raw.replace(/^#\s+.*\n+/, "");
  const sections = splitSections(body);

  const objectiveMd = sectionByLabel(sections, "教学目标");
  const practiceMd = sectionByLabel(sections, "课堂引导练习");
  const homeworkMd = sectionByLabel(sections, "独立作业");
  const prerequisite = (raw.match(/\*\*前置要求：\*\*\s*(.+)/) || [])[1];

  const total = l.duration_minutes || 120;
  const per = Math.round(total / 3);

  const slug = l.id.toLowerCase();

  return {
    slug,
    code: l.id,
    title: l.title,
    status: manifest.content_status === "published" ? "published" : "published",
    moduleCode: l.module_id,
    unitName: (modules.find((m) => m.code === l.module_id) || {}).name || "",
    objective: (() => {
      const items = bullets(objectiveMd && objectiveMd.md).map((s) => s.replace(/[。；;，,]\s*$/, ""));
      return items.length ? `${items.join("；")}。` : "";
    })(),
    prerequisite: prerequisite ? prerequisite.trim() : "无。",
    minutes: { main: per, aux: per, independent: total - per * 2 },
    taskSummary:
      (bullets(homeworkMd && homeworkMd.md)[0] || l.title).slice(0, 90),
    sections: sections.map((s) => ({ key: `sec-${s.no}`, no: s.no, label: s.label, md: s.md })),
    exercises: [
      practiceMd && {
        code: "E01",
        title: "课堂引导练习",
        type: "copy",
        typeLabel: "引导练习",
        independent: false,
        purpose: "跟着示范走一遍，确认这一节的操作能复现。",
        allowed: ["查看本节示范与知识内容", "对照验收标准自查"],
        prohibited: ["直接使用自动描边或素材拼贴替代手绘"],
        requirements: bullets(practiceMd.md).slice(0, 6),
      },
      homeworkMd && {
        code: "E02",
        title: "独立作业",
        type: "independent",
        typeLabel: "独立作业",
        independent: true,
        purpose: "脱离示范，检验能否把本节的方法独立用出来。",
        allowed: ["查看本节知识内容与验收标准"],
        prohibited: ["照抄示范步骤", "只提交最终截图不留工程文件"],
        requirements: bullets(homeworkMd.md).slice(0, 6),
      },
    ].filter(Boolean),
  };
});

/* ------------------------------------------------------------------ */
/* 输出                                                                */
/* ------------------------------------------------------------------ */

const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const lines = [];
lines.push("/**");
lines.push(" * 画室 · 课程数据（自动生成，勿手改）");
lines.push(" *");
lines.push(` * 来源：${manifest.title} v${manifest.version}（${lessons.length} 节）`);
lines.push(" * 重新生成：node scripts/build-studio-curriculum.mjs <课程包目录>");
lines.push(" */");
lines.push("");
lines.push('import type { StudioLesson, StudioModule, StudioStage } from "./types";');
lines.push("");
lines.push("export const STUDIO_STAGE: StudioStage = {");
lines.push(`  code: ${q("L1")},`);
lines.push(`  name: ${q("预科班")},`);
lines.push(`  goal: ${q(manifest.title)} ,`);
lines.push("};");
lines.push("");
lines.push("export const STUDIO_MODULES: StudioModule[] = [");
for (const m of modules) {
  lines.push("  {");
  lines.push(`    code: ${q(m.code)},`);
  lines.push(`    name: ${q(m.name)},`);
  lines.push(`    ordinal: ${m.ordinal},`);
  lines.push(`    goal: ${q(m.goal)},`);
  lines.push("  },");
}
lines.push("];");
lines.push("");
lines.push("export const STUDIO_LESSONS: StudioLesson[] = [");
for (const l of lessons) {
  lines.push("  {");
  lines.push(`    slug: ${q(l.slug)},`);
  lines.push(`    code: ${q(l.code)},`);
  lines.push(`    title: ${q(l.title)},`);
  lines.push(`    status: "published",`);
  lines.push(`    moduleCode: ${q(l.moduleCode)},`);
  lines.push(`    unitName: ${q(l.unitName)},`);
  lines.push(`    objective: ${q(l.objective)},`);
  lines.push(`    prerequisite: ${q(l.prerequisite)},`);
  lines.push(
    `    minutes: { main: ${l.minutes.main}, aux: ${l.minutes.aux}, independent: ${l.minutes.independent} },`
  );
  lines.push(`    taskSummary: ${q(l.taskSummary)},`);
  lines.push("    sections: [");
  for (const s of l.sections) {
    lines.push("      {");
    lines.push(`        key: ${q(s.key)},`);
    lines.push(`        no: ${q(s.no)},`);
    lines.push(`        label: ${q(s.label)},`);
    lines.push(`        md: \`${esc(s.md)}\`,`);
    lines.push("      },");
  }
  lines.push("    ],");
  lines.push("    exercises: [");
  for (const ex of l.exercises) {
    lines.push("      {");
    lines.push(`        code: ${q(ex.code)},`);
    lines.push(`        title: ${q(ex.title)},`);
    lines.push(`        type: ${q(ex.type)},`);
    lines.push(`        typeLabel: ${q(ex.typeLabel)},`);
    lines.push(`        independent: ${ex.independent},`);
    lines.push(`        purpose: ${q(ex.purpose)},`);
    lines.push(`        allowed: [${ex.allowed.map(q).join(", ")}],`);
    lines.push(`        prohibited: [${ex.prohibited.map(q).join(", ")}],`);
    lines.push(`        requirements: [${ex.requirements.map(q).join(", ")}],`);
    lines.push("      },");
  }
  lines.push("    ],");
  lines.push("  },");
}
lines.push("];");
lines.push("");

writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`已生成 ${OUT}：${modules.length} 个模块 / ${lessons.length} 节课`);
