/**
 * 背诵板块的数据访问层。
 *
 * 一律使用「用户会话」客户端，让 RLS 生效 —— 不在这里手写 owner 过滤条件，
 * 免得某天漏一个 where 就漏数据。service role 只出现在附件签名这类必须绕过
 * RLS 的场合，且调用前已用会话客户端确认过归属。
 */
import { createClient } from "@/lib/supabase/server";
import { dayWindow, endOfDay, overdueDays } from "@/lib/recite/day";
import {
  emptyState,
  preview,
  schedule,
  type Preview,
  type RatingKey,
  type StateRow,
} from "@/lib/recite/fsrs";

export type ItemType = "qa" | "note";

export type KnowledgeItem = {
  id: string;
  type: ItemType;
  title: string;
  question_md: string | null;
  answer_md: string | null;
  body_md: string | null;
  category: string | null;
  tags: string[];
  review_enabled: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ItemListItem = KnowledgeItem & { unit_count: number };

export type UnitRow = {
  id: string;
  source_item_id: string | null;
  source_type: "qa" | "note_selection" | "manual";
  front_md: string;
  back_md: string;
  source_snapshot: string | null;
  review_enabled: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type UnitWithState = UnitRow & {
  state: StateRow & { first_reviewed_at: string | null };
};

export type AttachmentRow = {
  id: string;
  item_id: string | null;
  review_unit_id: string | null;
  kind: "image" | "file";
  filename: string;
  mime: string;
  size: number;
  storage_key: string;
  created_at: string;
};

export type Settings = {
  daily_new_limit: number;
  auto_new_enabled: boolean;
  timezone: string;
  desired_retention: number;
};

export const DEFAULT_SETTINGS: Settings = {
  daily_new_limit: 10,
  auto_new_enabled: true,
  timezone: "Asia/Shanghai",
  desired_retention: 0.9,
};

const ITEM_COLUMNS =
  "id,type,title,question_md,answer_md,body_md,category,tags,review_enabled,created_at,updated_at,deleted_at";

// ---------------------------------------------------------------- 设置

export async function getSettings(userId: string): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recite_settings")
    .select("daily_new_limit,auto_new_enabled,timezone,desired_retention")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS;
  return {
    daily_new_limit: data.daily_new_limit ?? DEFAULT_SETTINGS.daily_new_limit,
    auto_new_enabled: data.auto_new_enabled ?? true,
    timezone: data.timezone || DEFAULT_SETTINGS.timezone,
    desired_retention: data.desired_retention ?? DEFAULT_SETTINGS.desired_retention,
  };
}

export async function saveSettings(userId: string, patch: Partial<Settings>) {
  const supabase = await createClient();
  const { error } = await supabase.from("recite_settings").upsert(
    {
      owner_user_id: userId,
      ...patch,
    },
    { onConflict: "owner_user_id" }
  );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- 知识内容

export async function listItems(opts: {
  type?: ItemType | "all";
  q?: string;
  tag?: string;
}): Promise<ItemListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("knowledge_item")
    .select(ITEM_COLUMNS)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (opts.type && opts.type !== "all") query = query.eq("type", opts.type);
  if (opts.q) {
    const term = opts.q.replace(/[%,]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,body_md.ilike.%${term}%,answer_md.ilike.%${term}%,question_md.ilike.%${term}%`);
  }
  if (opts.tag) query = query.contains("tags", [opts.tag]);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const items = (data ?? []) as KnowledgeItem[];
  const counts = await unitCounts(items.map((i) => i.id));
  return items.map((i) => ({ ...i, unit_count: counts[i.id] ?? 0 }));
}

async function unitCounts(itemIds: string[]): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_unit")
    .select("source_item_id")
    .in("source_item_id", itemIds)
    .is("deleted_at", null);

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = (row as { source_item_id: string }).source_item_id;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export async function getItem(id: string): Promise<KnowledgeItem | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_item")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as KnowledgeItem) ?? null;
}

export async function createItem(ownerId: string, type: ItemType): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_item")
    .insert({
      owner_user_id: ownerId,
      type,
      title: type === "qa" ? "未命名问答" : "未命名笔记",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function updateItem(id: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("knowledge_item").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * 删除知识内容。
 * keepUnits=true → 关联复习单元保留为独立单元（source_item_id 置空，由外键 set null 完成）；
 * keepUnits=false → 连同复习单元、调度状态、复习历史一起删（外键 cascade）。
 */
export async function deleteItem(id: string, keepUnits: boolean) {
  const supabase = await createClient();
  if (!keepUnits) {
    const { data: units } = await supabase
      .from("review_unit")
      .select("id")
      .eq("source_item_id", id);
    const ids = (units ?? []).map((u) => (u as { id: string }).id);
    if (ids.length > 0) {
      await supabase.from("review_unit").delete().in("id", ids);
    }
  }
  const { error } = await supabase.from("knowledge_item").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listTags(): Promise<{ tag: string; count: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_item")
    .select("tags")
    .is("deleted_at", null);

  const counter = new Map<string, number>();
  (data ?? []).forEach((row) => {
    ((row as { tags: string[] }).tags ?? []).forEach((t) => {
      counter.set(t, (counter.get(t) ?? 0) + 1);
    });
  });
  return [...counter.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------- 复习单元

export async function listUnitsByItem(itemId: string): Promise<UnitWithState[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_unit")
    .select("*, review_state(*)")
    .eq("source_item_id", itemId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const { review_state: stateArr, ...unit } = row as UnitRow & {
      review_state: (StateRow & { first_reviewed_at: string | null })[];
    };
    const state = Array.isArray(stateArr) ? stateArr[0] : (stateArr as unknown as StateRow);
    return {
      ...unit,
      state: (state ?? { ...emptyState(), first_reviewed_at: null }) as UnitWithState["state"],
    };
  });
}

export async function getUnit(id: string): Promise<UnitWithState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_unit")
    .select("*, review_state(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  const { review_state: stateArr, ...unit } = data as UnitRow & {
    review_state: (StateRow & { first_reviewed_at: string | null })[];
  };
  const state = Array.isArray(stateArr) ? stateArr[0] : (stateArr as unknown as StateRow);
  return {
    ...unit,
    state: (state ?? { ...emptyState(), first_reviewed_at: null }) as UnitWithState["state"],
  };
}

export async function createUnit(
  ownerId: string,
  input: {
    front_md: string;
    back_md: string;
    source_item_id?: string | null;
    source_type?: "qa" | "note_selection" | "manual";
    source_snapshot?: string | null;
    source_anchor?: Record<string, unknown> | null;
    review_enabled?: boolean;
  }
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_unit")
    .insert({
      owner_user_id: ownerId,
      source_item_id: input.source_item_id ?? null,
      source_type: input.source_type ?? "manual",
      front_md: input.front_md,
      back_md: input.back_md,
      source_snapshot: input.source_snapshot ?? null,
      source_anchor: input.source_anchor ?? null,
      review_enabled: input.review_enabled ?? true,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const unitId = (data as { id: string }).id;

  const state = emptyState();
  const { error: stateError } = await supabase.from("review_state").insert({
    review_unit_id: unitId,
    owner_user_id: ownerId,
    ...state,
  });
  if (stateError) throw new Error(stateError.message);

  return unitId;
}

export async function updateUnit(id: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("review_unit").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteUnit(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("review_unit").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * 问答卡片与复习单元的对应关系：
 * 一张问答卡 = 一个复习单元（正反面就是问答的两面）。
 * 内容以 knowledge_item 为真源，单元只是调度壳；保存时同步过去，
 * 关闭复习时把单元暂停而不是删除，历史记录得以保留。
 */
export async function ensureQaUnit(
  ownerId: string,
  itemId: string,
  front: string,
  back: string,
  enabled: boolean
): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_unit")
    .select("id")
    .eq("source_item_id", itemId)
    .eq("source_type", "qa")
    .is("deleted_at", null)
    .maybeSingle();

  const existing = (data as { id: string } | null) ?? null;

  if (!existing) {
    if (!enabled) return;
    await createUnit(ownerId, {
      front_md: front,
      back_md: back,
      source_item_id: itemId,
      source_type: "qa",
      source_snapshot: back,
      review_enabled: true,
    });
    return;
  }

  await updateUnit(existing.id, { front_md: front, back_md: back, review_enabled: enabled });
}

// ---------------------------------------------------------------- 今日队列
export type QueueCard = {
  unitId: string;
  front_md: string;
  back_md: string;
  bucket: "overdue" | "today" | "new";
  due_at: string;
  overdueDays: number;
  reps: number;
  state: number;
  preview: Preview;
};

export type Queue = {
  cards: QueueCard[];
  counts: {
    overdue: number;
    today: number;
    newCards: number;
    newQuotaLeft: number;
    reviewedToday: number;
    totalDue: number;
  };
  settings: Settings;
};

/**
 * 今日队列：逾期 + 今日到期 + 新卡（受每日自动上限约束）。
 *
 * 全部到期项都会返回，不做硬性截断 —— 只是把总数和「建议分批」交给界面呈现。
 */
export async function buildQueue(userId: string, now = new Date()): Promise<Queue> {
  const supabase = await createClient();
  const settings = await getSettings(userId);
  const { start, end } = dayWindow(settings.timezone, now);

  const { data, error } = await supabase
    .from("review_unit")
    .select("id,front_md,back_md,created_at,review_enabled,deleted_at,review_state(*)")
    .is("deleted_at", null)
    .eq("review_enabled", true);

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    front_md: string;
    back_md: string;
    created_at: string;
    review_state: (StateRow & { first_reviewed_at: string | null })[];
  };

  const todayStr = start.toISOString();
  const endStr = end.toISOString();

  const overdue: QueueCard[] = [];
  const today: QueueCard[] = [];
  const fresh: QueueCard[] = [];
  let introducedToday = 0;

  for (const raw of (data ?? []) as Row[]) {
    const stateArr = Array.isArray(raw.review_state) ? raw.review_state[0] : raw.review_state;
    if (!stateArr) continue;
    const state = stateArr as StateRow & { first_reviewed_at: string | null };

    if (state.first_reviewed_at && state.first_reviewed_at >= todayStr) introducedToday += 1;

    const card: QueueCard = {
      unitId: raw.id,
      front_md: raw.front_md,
      back_md: raw.back_md,
      bucket: state.reps === 0 ? "new" : "overdue",
      due_at: state.due_at,
      overdueDays: overdueDays(state.due_at, start),
      reps: state.reps,
      state: state.fsrs_state,
      preview: preview(state, { retention: settings.desired_retention, now }),
    };

    if (state.reps === 0) {
      fresh.push(card);
      continue;
    }
    if (state.due_at < todayStr) {
      overdue.push({ ...card, bucket: "overdue" });
    } else if (state.due_at < endStr) {
      today.push({ ...card, bucket: "today" });
    }
  }

  overdue.sort((a, b) => a.due_at.localeCompare(b.due_at));
  today.sort((a, b) => a.due_at.localeCompare(b.due_at));

  const quota = settings.auto_new_enabled
    ? Math.max(0, settings.daily_new_limit - introducedToday)
    : 0;
  const newCards = fresh.slice(0, quota).map((c) => ({ ...c, bucket: "new" as const }));

  const { count: reviewedToday } = await supabase
    .from("review_log")
    .select("id", { count: "exact", head: true })
    .gte("reviewed_at", todayStr);

  return {
    cards: [...overdue, ...today, ...newCards],
    counts: {
      overdue: overdue.length,
      today: today.length,
      newCards: newCards.length,
      newQuotaLeft: Math.max(0, quota - newCards.length),
      reviewedToday: reviewedToday ?? 0,
      totalDue: overdue.length + today.length + newCards.length,
    },
    settings,
  };
}

/** 今日概览数字（首页用，不构造完整队列以省一次大查询） */
export async function todaySummary(userId: string, now = new Date()) {
  const queue = await buildQueue(userId, now);
  return {
    counts: queue.counts,
    settings: queue.settings,
    first: queue.cards[0] ?? null,
  };
}

// ---------------------------------------------------------------- 提交评价

export type SubmitResult = {
  due_at: string;
  state: number;
  reps: number;
  intervalDays: number;
};

/**
 * 提交一次正式复习。
 * - 先读当前状态（RLS 保证是自己的）→ FSRS 计算 → 写状态 → 追加日志。
 * - clientToken 用于挡住双击重复提交：同单元同 token 只落一条日志。
 */
export async function submitReview(
  ownerId: string,
  unitId: string,
  rating: RatingKey,
  clientToken?: string | null
): Promise<SubmitResult> {
  const supabase = await createClient();

  const { data: stateRow, error } = await supabase
    .from("review_state")
    .select("*")
    .eq("review_unit_id", unitId)
    .single();

  if (error || !stateRow) throw new Error("找不到这张卡片的复习状态");

  const settings = await getSettings(ownerId);
  const current = stateRow as StateRow & { first_reviewed_at: string | null };

  const { next, log } = schedule(current, rating, {
    retention: settings.desired_retention,
    firstReviewedAt: current.first_reviewed_at,
  });

  const { error: writeState } = await supabase
    .from("review_state")
    .update({
      due_at: next.due_at,
      last_reviewed_at: next.last_reviewed_at,
      first_reviewed_at: next.first_reviewed_at,
      stability: next.stability,
      difficulty: next.difficulty,
      fsrs_state: next.fsrs_state,
      reps: next.reps,
      lapses: next.lapses,
      scheduled_days: next.scheduled_days,
      learning_steps: next.learning_steps,
      elapsed_days: next.elapsed_days,
    })
    .eq("review_unit_id", unitId);

  if (writeState) throw new Error(writeState.message);

  const { error: writeLog } = await supabase.from("review_log").insert({
    owner_user_id: ownerId,
    review_unit_id: unitId,
    rating: log.rating,
    reviewed_at: new Date().toISOString(),
    state_before: log.state_before,
    state_after: log.state_after,
    due_before: log.due_before,
    due_after: log.due_after,
    stability_after: log.stability_after,
    difficulty_after: log.difficulty_after,
    elapsed_days: log.elapsed_days,
    scheduler_version: log.scheduler_version,
    client_token: clientToken || null,
  });

  // 重复 token 会被唯一索引挡住；这种情况状态已按第一次的结果算过，直接当做成功
  if (writeLog && writeLog.code !== "23505") throw new Error(writeLog.message);

  return {
    due_at: next.due_at,
    state: next.fsrs_state,
    reps: next.reps,
    intervalDays: Math.max(
      0,
      Math.round((new Date(next.due_at).getTime() - Date.now()) / 86_400_000)
    ),
  };
}

// ---------------------------------------------------------------- 统计

export type Stats = {
  reviewedToday: number;
  reviews7d: number;
  totalItems: number;
  qaItems: number;
  noteItems: number;
  totalUnits: number;
  newUnits: number;
  learningUnits: number;
  matureUnits: number;
  suspendedUnits: number;
  overdue: number;
  dueToday: number;
  lapses7d: number;
  trend: { day: string; count: number }[];
};

export async function getStats(userId: string, now = new Date()): Promise<Stats> {
  const supabase = await createClient();
  const settings = await getSettings(userId);
  const { start, end } = dayWindow(settings.timezone, now);
  const weekAgo = new Date(start.getTime() - 6 * 86_400_000);
  const trendFrom = new Date(start.getTime() - 13 * 86_400_000);

  const [items, units, states, logs, todayLogs, suspended] = await Promise.all([
    supabase.from("knowledge_item").select("id,type").is("deleted_at", null),
    supabase.from("review_unit").select("id").is("deleted_at", null),
    supabase.from("review_state").select("fsrs_state,due_at,scheduled_days,reps"),
    supabase
      .from("review_log")
      .select("reviewed_at,rating")
      .gte("reviewed_at", trendFrom.toISOString()),
    supabase
      .from("review_log")
      .select("id", { count: "exact", head: true })
      .gte("reviewed_at", start.toISOString()),
    supabase
      .from("review_unit")
      .select("id", { count: "exact", head: true })
      .eq("review_enabled", false)
      .is("deleted_at", null),
  ]);

  const itemRows = (items.data ?? []) as { id: string; type: ItemType }[];
  const stateRows = (states.data ?? []) as {
    fsrs_state: number;
    due_at: string;
    scheduled_days: number;
    reps: number;
  }[];
  const logRows = (logs.data ?? []) as { reviewed_at: string; rating: number }[];

  const newUnits = stateRows.filter((s) => s.reps === 0).length;
  const matureUnits = stateRows.filter((s) => s.fsrs_state === 2 && s.scheduled_days >= 21).length;
  const learningUnits = stateRows.filter(
    (s) => s.reps > 0 && !(s.fsrs_state === 2 && s.scheduled_days >= 21)
  ).length;

  const buckets = new Map<string, number>();
  logRows.forEach((row) => {
    const key = new Date(row.reviewed_at).toLocaleDateString("sv-SE", {
      timeZone: settings.timezone,
    });
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  const trend: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(start.getTime() - i * 86_400_000);
    const key = d.toLocaleDateString("sv-SE", { timeZone: settings.timezone });
    trend.push({ day: key, count: buckets.get(key) ?? 0 });
  }

  return {
    reviewedToday: todayLogs.count ?? 0,
    reviews7d: logRows.filter((r) => new Date(r.reviewed_at) >= weekAgo).length,
    totalItems: itemRows.length,
    qaItems: itemRows.filter((i) => i.type === "qa").length,
    noteItems: itemRows.filter((i) => i.type === "note").length,
    totalUnits: (units.data ?? []).length,
    newUnits,
    learningUnits,
    matureUnits,
    suspendedUnits: suspended.count ?? 0,
    overdue: stateRows.filter((s) => s.reps > 0 && s.due_at < start.toISOString()).length,
    dueToday: stateRows.filter(
      (s) => s.reps > 0 && s.due_at >= start.toISOString() && s.due_at < end.toISOString()
    ).length,
    lapses7d: logRows.filter((r) => r.rating === 1).length,
    trend,
  };
}

// ---------------------------------------------------------------- 附件

export async function listAttachments(opts: {
  itemId?: string;
  unitId?: string;
}): Promise<AttachmentRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("attachment")
    .select("id,item_id,review_unit_id,kind,filename,mime,size,storage_key,created_at")
    .order("created_at", { ascending: true });

  if (opts.itemId) query = query.eq("item_id", opts.itemId);
  if (opts.unitId) query = query.eq("review_unit_id", opts.unitId);

  const { data } = await query;
  return (data ?? []) as AttachmentRow[];
}

export async function getAttachment(id: string): Promise<AttachmentRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachment")
    .select("id,item_id,review_unit_id,kind,filename,mime,size,storage_key,created_at")
    .eq("id", id)
    .maybeSingle();
  return (data as AttachmentRow) ?? null;
}

export async function deleteAttachment(id: string) {
  const supabase = await createClient();
  const row = await getAttachment(id);
  if (!row) return;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().storage.from("private").remove([row.storage_key]);
  await supabase.from("attachment").delete().eq("id", id);
}
