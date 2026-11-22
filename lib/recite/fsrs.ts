/**
 * FSRS 调度封装（ts-fsrs 6.x / FSRS-6 算法）
 *
 * 只做三件事：
 * 1. 把数据库里的 review_state 行 ↔ FSRS Card 互转；
 * 2. 给一个评分，算出新的 Card 和本次日志；
 * 3. 给四个评分各算一次，供复习界面显示「这张会排到几天后」。
 *
 * 产品层不写死任何间隔（需求 §8.2），间隔一律由算法给出。
 */
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
  type FSRS,
} from "ts-fsrs";

export const SCHEDULER_VERSION = "ts-fsrs-6";

/** 数据库里存的四档评价 */
export const RATINGS = ["again", "hard", "good", "easy"] as const;
export type RatingKey = (typeof RATINGS)[number];

const GRADE: Record<RatingKey, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export const RATING_LABEL: Record<RatingKey, { label: string; hint: string }> = {
  again: { label: "重来", hint: "完全没想起来" },
  hard: { label: "困难", hint: "想起来了，但很费劲" },
  good: { label: "良好", hint: "正常回忆起来" },
  easy: { label: "简单", hint: "一眼就想起" },
};

export function isRatingKey(v: unknown): v is RatingKey {
  return typeof v === "string" && (RATINGS as readonly string[]).includes(v);
}

export const STATE_NAME: Record<number, string> = {
  0: "新卡",
  1: "学习中",
  2: "复习中",
  3: "再学习",
};

/**
 * 参数选择说明：
 * - enable_short_term: false —— 关闭 1m/10m 的短期学习步骤。
 *   本板块按「天」组织队列（今日到期 / 逾期 / 新卡），若保留分钟级步骤，
 *   新卡评分后 10 分钟又会到期，同一天反复出现，与「今天这批做完就结束」的节奏冲突。
 * - enable_fuzz: true —— 同一批卡片的到期时间加一点随机抖动，避免长期堆积在同一天。
 */
const BASE_PARAMS = {
  enable_short_term: false,
  enable_fuzz: true,
  maximum_interval: 3650,
};

const cache = new Map<number, FSRS>();

/** 目标记忆保留率来自用户设置（默认 0.9），算法实例按保留率缓存 */
export function scheduler(retention = 0.9): FSRS {
  const key = Math.round(retention * 1000);
  const hit = cache.get(key);
  if (hit) return hit;
  const instance = fsrs(
    generatorParameters({
      ...BASE_PARAMS,
      request_retention: Math.min(0.99, Math.max(0.7, retention)),
    })
  );
  cache.set(key, instance);
  return instance;
}

export type StateRow = {
  due_at: string;
  last_reviewed_at: string | null;
  stability: number;
  difficulty: number;
  fsrs_state: number;
  reps: number;
  lapses: number;
  scheduled_days: number;
  learning_steps: number;
  elapsed_days: number;
};

export type ScheduleResult = {
  next: StateRow & { first_reviewed_at?: string };
  log: {
    rating: number;
    state_before: number;
    state_after: number;
    due_before: string;
    due_after: string;
    stability_after: number;
    difficulty_after: number;
    elapsed_days: number;
    scheduler_version: string;
  };
};

function toCard(row: StateRow): Card {
  return {
    due: new Date(row.due_at),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.fsrs_state as State,
    last_review: row.last_reviewed_at ? new Date(row.last_reviewed_at) : undefined,
  };
}

/** 新单元初始状态：due = 现在，state = New */
export function emptyState(now = new Date()): StateRow {
  const card = createEmptyCard(now);
  return {
    due_at: card.due.toISOString(),
    last_reviewed_at: null,
    stability: card.stability,
    difficulty: card.difficulty,
    fsrs_state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    elapsed_days: card.elapsed_days,
  };
}

export function schedule(
  current: StateRow,
  rating: RatingKey,
  opts: { retention?: number; now?: Date; firstReviewedAt?: string | null } = {}
): ScheduleResult {
  const now = opts.now ?? new Date();
  const f = scheduler(opts.retention ?? 0.9);
  const result = f.next(toCard(current), now, GRADE[rating]);
  const card = result.card;

  return {
    next: {
      due_at: card.due.toISOString(),
      last_reviewed_at: now.toISOString(),
      first_reviewed_at: opts.firstReviewedAt ?? now.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      fsrs_state: card.state,
      reps: card.reps,
      lapses: card.lapses,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      elapsed_days: Math.max(0, Math.round((now.getTime() - new Date(current.due_at).getTime()) / 86_400_000)),
    },
    log: {
      rating: GRADE[rating],
      state_before: current.fsrs_state,
      state_after: card.state,
      due_before: current.due_at,
      due_after: card.due.toISOString(),
      stability_after: card.stability,
      difficulty_after: card.difficulty,
      elapsed_days: card.elapsed_days ?? 0,
      scheduler_version: SCHEDULER_VERSION,
    },
  };
}

export type Preview = Record<RatingKey, { due: string; days: number; label: string }>;

/** 四档评分各自的落点，用于按钮上显示「1天 / 3天 / 5天」 */
export function preview(
  current: StateRow,
  opts: { retention?: number; now?: Date } = {}
): Preview {
  const now = opts.now ?? new Date();
  const out = {} as Preview;
  for (const key of RATINGS) {
    const { next } = schedule(current, key, { ...opts, now });
    const days = Math.max(
      0,
      Math.round((new Date(next.due_at).getTime() - now.getTime()) / 86_400_000)
    );
    out[key] = { due: next.due_at, days, label: humanInterval(days) };
  }
  return out;
}

function humanInterval(days: number): string {
  if (days <= 0) return "今天";
  if (days === 1) return "1 天";
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.round(days / 30)} 个月`;
  return `${(days / 365).toFixed(1)} 年`;
}

export { Rating, State };
