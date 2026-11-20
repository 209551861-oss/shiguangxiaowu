/**
 * 画室 · 课程入口
 *
 * 教材数据在 curriculum-data.ts（由「绘画学院」课程包生成），
 * 这里只放类型出口与查询函数，页面永远 import 本文件。
 *
 * 重新生成数据：
 *   node scripts/build-studio-curriculum.mjs <课程包目录>
 */

import { STUDIO_LESSONS, STUDIO_MODULES } from "./curriculum-data";
import type { StudioLesson, StudioModule } from "./types";

export * from "./types";
export { STUDIO_STAGE, STUDIO_MODULES, STUDIO_LESSONS } from "./curriculum-data";

/** 按 slug 取一节课 */
export function getStudioLesson(slug: string): StudioLesson | undefined {
  return STUDIO_LESSONS.find((l) => l.slug === slug);
}

/** 某个模块下的课，按课程编号排序 */
export function lessonsOfModule(code: string): StudioLesson[] {
  return STUDIO_LESSONS.filter((l) => l.moduleCode === code);
}

/** 按编号取模块 */
export function getStudioModule(code: string): StudioModule | undefined {
  return STUDIO_MODULES.find((m) => m.code === code);
}

/** 课时合计（分钟） */
export function lessonMinutes(l: StudioLesson): number {
  return l.minutes.main + l.minutes.aux + l.minutes.independent;
}

/** 整门课的总分钟数 */
export function totalMinutes(): number {
  return STUDIO_LESSONS.reduce((sum, l) => sum + lessonMinutes(l), 0);
}

/** 下一节要学的课：没有进度记录时就是第一节 */
export function firstLesson(): StudioLesson | undefined {
  return STUDIO_LESSONS[0];
}
