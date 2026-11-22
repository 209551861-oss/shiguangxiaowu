/**
 * 「今天」的边界。
 *
 * 到期判断按天而不是按分钟：FSRS 给出的 due_at 是精确时间，但复习队列
 * 以用户时区的自然日为界（和 Anki 一致），否则早上打开时「今天 15:00 到期」
 * 的卡片会被判成未到期，看起来像丢了任务。
 */

function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(at)
    .reduce<Record<string, number>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = Number(p.value);
      return acc;
    }, {});

  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUTC - at.getTime();
}

/** 该时刻所在自然日的 00:00（返回 UTC 瞬时） */
export function startOfDay(at: Date, timeZone: string): Date {
  const off = offsetMs(at, timeZone);
  const local = new Date(at.getTime() + off);
  const midnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate()
  );
  // 再校正一次，覆盖夏令时切换
  const guess = new Date(midnight - off);
  const off2 = offsetMs(guess, timeZone);
  return new Date(midnight - off2);
}

export function endOfDay(at: Date, timeZone: string): Date {
  const start = startOfDay(at, timeZone);
  const next = new Date(start.getTime() + 26 * 3600_000);
  return startOfDay(next, timeZone);
}

export function dayWindow(timeZone: string, now = new Date()) {
  return {
    start: startOfDay(now, timeZone),
    end: endOfDay(now, timeZone),
    now,
  };
}

/** 逾期天数（向上取整，0 表示今天到期） */
export function overdueDays(dueAt: string, start: Date): number {
  const diff = start.getTime() - new Date(dueAt).getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}
