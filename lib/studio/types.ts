/** 画室 · 课程数据类型（数据见 curriculum-data.ts，由课程包生成） */

export type StudioQuiz = { q: string; a: string };

export type StudioSection = {
  key: string;
  no: string;
  label: string;
  /** Markdown 正文（GFM 表格、引用块均支持） */
  md?: string;
  /** 需要渲染交互/图形教材时指定 */
  figure?: "sphere";
  /** 知识小测：渲染成可展开的问答卡 */
  quiz?: StudioQuiz[];
};

export type StudioExercise = {
  code: string;
  title: string;
  type: "copy" | "independent";
  typeLabel: string;
  /** 是否为独立应用证据（不给示范步骤） */
  independent: boolean;
  purpose: string;
  allowed: string[];
  prohibited: string[];
  requirements: string[];
};

export type StudioLesson = {
  slug: string;
  code: string;
  title: string;
  status: "published" | "empty";
  /** 所属模块编号，如 M04 */
  moduleCode: string;
  unitName: string;
  objective: string;
  prerequisite: string;
  minutes: { main: number; aux: number; independent: number };
  taskSummary: string;
  sections: StudioSection[];
  exercises: StudioExercise[];
};

export type StudioStage = {
  code: string;
  name: string;
  goal: string;
};

export type StudioModule = {
  code: string;
  name: string;
  ordinal: number;
  goal: string;
};
