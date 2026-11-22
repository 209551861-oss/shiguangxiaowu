"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Prose from "@/components/recite/Prose";
import { submitReviewAction } from "@/app/(site)/recite/actions";
import type { QueueCard } from "@/lib/services/recite";
import { RATINGS, RATING_LABEL, type RatingKey } from "@/lib/recite/fsrs";

const KEY_TO_RATING: Record<string, RatingKey> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

const RATING_STYLE: Record<RatingKey, string> = {
  again: "border-[#e3b7a8] bg-[#fdf1ec] text-[#9c4a2f] hover:bg-[#fbe7df]",
  hard: "border-[#e2d3a8] bg-[#fdf8ea] text-[#8a6d2f] hover:bg-[#fbf2d9]",
  good: "border-[#b9cba4] bg-[#f1f7ea] text-forest hover:bg-[#e7f1dc]",
  easy: "border-[#b6c3d8] bg-[#f0f4fa] text-[#3c5878] hover:bg-[#e4ecf7]",
};

function newToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ReviewSession({
  cards,
  timezone,
}: {
  cards: QueueCard[];
  timezone: string;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [finished, setFinished] = useState(cards.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [last, setLast] = useState<{ rating: RatingKey; days: number } | null>(null);
  const tokenRef = useRef(newToken());
  const startedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const card = cards[idx];
  const total = cards.length;

  const advance = useCallback(() => {
    setLast(null);
    setRevealed(false);
    tokenRef.current = newToken();
    setIdx((i) => {
      const next = i + 1;
      if (next >= total) {
        setFinished(true);
        return i;
      }
      return next;
    });
  }, [total]);

  const rate = useCallback(
    async (rating: RatingKey) => {
      if (!card || pending || !revealed) return;
      setPending(true);
      setError(null);
      try {
        const result = await submitReviewAction({
          unitId: card.unitId,
          rating,
          token: tokenRef.current,
        });
        setTally((t) => ({ ...t, [rating]: (t[rating] ?? 0) + 1 }));
        setLast({ rating, days: result.intervalDays });
        window.setTimeout(advance, 450);
      } catch (err) {
        setError(err instanceof Error ? err.message : "提交失败，可以再点一次");
      } finally {
        setPending(false);
      }
    },
    [advance, card, pending, revealed]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (finished) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      const rating = KEY_TO_RATING[event.key];
      if (rating && revealed) {
        event.preventDefault();
        void rate(rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, rate, revealed]);

  useEffect(() => {
    if (!finished) return;
    setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
  }, [finished]);

  const done = useMemo(
    () => Object.values(tally).reduce((a, b) => a + b, 0),
    [tally]
  );

  if (finished) {
    return (
      <div className="rounded-3xl border border-line bg-paper p-8 text-center shadow-soft">
        <p className="text-xs tracking-[0.28em] text-muted">SESSION DONE</p>
        <h2 className="mt-2 font-serif text-2xl text-forest">
          {done === 0 ? "这批没有需要复习的卡片" : `这一轮复习了 ${done} 张`}
        </h2>
        {done > 0 && (
          <>
            <p className="mt-2 text-sm text-muted">
              用时 {Math.max(1, Math.round(elapsed / 60))} 分钟 · 平均{" "}
              {Math.max(1, Math.round(elapsed / done))} 秒一张
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((key) => (
                <div key={key} className="rounded-2xl border border-line bg-mist/60 p-3">
                  <p className="text-xs text-muted">{RATING_LABEL[key].label}</p>
                  <p className="mt-1 font-serif text-xl text-forest">{tally[key] ?? 0}</p>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/recite"
            className="rounded-pill bg-forest px-6 py-2 text-sm text-paper shadow-press transition hover:-translate-y-0.5"
          >
            回到今日
          </Link>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-pill border border-line bg-paper px-6 py-2 text-sm text-forest hover:bg-leaf/10"
          >
            看看还有没有到期
          </button>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {idx + 1} / {total}
          {card.bucket === "overdue" && card.overdueDays > 0 && (
            <span className="ml-2 rounded-full bg-[#fdf1ec] px-2 py-0.5 text-[#9c4a2f]">
              逾期 {card.overdueDays} 天
            </span>
          )}
          {card.bucket === "new" && (
            <span className="ml-2 rounded-full bg-pollen/60 px-2 py-0.5 text-forest">新卡</span>
          )}
        </span>
        <span>空格揭示答案 · 1–4 评价</span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-forest transition-all"
          style={{ width: `${Math.round((idx / Math.max(1, total)) * 100)}%` }}
        />
      </div>

      <div className="rounded-3xl border border-line bg-paper p-6 shadow-soft">
        <div className="min-h-[120px]">
          <Prose content={card.front_md || "（正面为空）"} />
        </div>

        {revealed && (
          <div className="mt-6 border-t border-dashed border-line pt-5">
            <p className="mb-2 text-[11px] tracking-widest text-muted">答案</p>
            <Prose content={card.back_md || "（背面为空）"} />
          </div>
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded-pill bg-forest py-3 text-sm text-paper shadow-press transition hover:bg-ink"
        >
          显示答案
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => void rate(key)}
              className={`rounded-2xl border px-3 py-3 text-sm transition disabled:opacity-50 ${RATING_STYLE[key]}`}
            >
              <span className="block font-medium">{RATING_LABEL[key].label}</span>
              <span className="mt-0.5 block text-[11px] opacity-70">
                {card.preview[key].label}
              </span>
            </button>
          ))}
        </div>
      )}

      {last && (
        <p className="text-center text-xs text-leaf">
          已记下「{RATING_LABEL[last.rating].label}」，下次约 {last.days <= 0 ? "今天" : `${last.days} 天后`}
        </p>
      )}
      {error && <p className="text-center text-xs text-red-700">{error}</p>}
      <p className="text-center text-[11px] text-muted">
        中途退出没关系，已经评过的都记下了，没评的下次还在。时区按 {timezone} 算「今天」。
      </p>
    </div>
  );
}
