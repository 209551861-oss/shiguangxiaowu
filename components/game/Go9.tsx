"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Stone = 0 | 1 | 2; // 0 空 1 黑 2 白
type Board = Stone[];

const N = 9;
const NN = N * N;
const KOMI = 6.5;
const GAP = 42;
const PAD = 30;
const SIDE = PAD * 2 + GAP * (N - 1);

const at = (r: number, c: number) => r * N + c;
const row = (i: number) => Math.floor(i / N);
const col = (i: number) => i % N;
const px = (c: number) => PAD + c * GAP;
const py = (r: number) => PAD + r * GAP;

function neighbors(i: number): number[] {
  const r = row(i), c = col(i);
  const out: number[] = [];
  if (r > 0) out.push(at(r - 1, c));
  if (r < N - 1) out.push(at(r + 1, c));
  if (c > 0) out.push(at(r, c - 1));
  if (c < N - 1) out.push(at(r, c + 1));
  return out;
}

const NB: number[][] = Array.from({ length: NN }, (_, i) => neighbors(i));

function group(b: Board, start: number) {
  const color = b[start];
  const stones = new Set<number>([start]);
  const libs = new Set<number>();
  const stack = [start];
  while (stack.length) {
    const p = stack.pop()!;
    for (const q of NB[p]) {
      if (b[q] === 0) libs.add(q);
      else if (b[q] === color && !stones.has(q)) {
        stones.add(q);
        stack.push(q);
      }
    }
  }
  return { stones, libs };
}

function play(b: Board, i: number, color: Stone): Board | null {
  if (b[i] !== 0) return null;
  const nb = b.slice();
  nb[i] = color;
  const enemy: Stone = color === 1 ? 2 : 1;
  let captured = 0;
  for (const q of NB[i]) {
    if (nb[q] === enemy) {
      const g = group(nb, q);
      if (g.libs.size === 0) {
        for (const s of g.stones) nb[s] = 0;
        captured += g.stones.size;
      }
    }
  }
  const own = group(nb, i);
  if (own.libs.size === 0 && captured === 0) return null; // 自杀
  return nb;
}

function key(b: Board) {
  return b.join("");
}

function score(b: Board) {
  let black = 0, white = 0;
  for (let i = 0; i < NN; i++) {
    if (b[i] === 1) black++;
    else if (b[i] === 2) white++;
  }
  const seen = new Set<number>();
  for (let i = 0; i < NN; i++) {
    if (b[i] !== 0 || seen.has(i)) continue;
    const region = new Set<number>([i]);
    const stack = [i];
    const borders = new Set<Stone>();
    while (stack.length) {
      const p = stack.pop()!;
      for (const q of NB[p]) {
        if (b[q] === 0 && !region.has(q)) {
          region.add(q);
          stack.push(q);
        } else if (b[q] !== 0) borders.add(b[q]);
      }
    }
    region.forEach((r) => seen.add(r));
    if (borders.size === 1) {
      if (borders.has(1)) black += region.size;
      else white += region.size;
    }
  }
  return { black, white };
}

/** 简单启发：提子 > 连自己 > 贴身 > 边角 */
function aiPick(b: Board, color: Stone, banned: string): number | null {
  const enemy: Stone = color === 1 ? 2 : 1;
  const cands: { i: number; s: number }[] = [];
  for (let i = 0; i < NN; i++) {
    if (b[i] !== 0) continue;
    const nb = play(b, i, color);
    if (!nb || key(nb) === banned) continue;
    let s = Math.random() * 4;
    let caps = 0;
    for (const q of NB[i]) if (b[q] === enemy) {
      const g = group(b, q);
      if (g.libs.size === 1) caps += g.stones.size;
    }
    s += caps * 12;
    for (const q of NB[i]) {
      if (b[q] === color) s += 2;
      else if (b[q] === enemy) s += 1.2;
    }
    const r = row(i), c = col(i);
    s += (4 - Math.abs(4 - r)) * 0.4 + (4 - Math.abs(4 - c)) * 0.4;
    cands.push({ i, s });
  }
  if (!cands.length) return null;
  cands.sort((a, z) => z.s - a.s);
  return cands[0].i;
}

export default function Go9() {
  const [board, setBoard] = useState<Board>(new Array(NN).fill(0) as Board);
  const [side, setSide] = useState<Stone>(1);
  const [history, setHistory] = useState<Board[]>([]);
  const [last, setLast] = useState(-1);
  const [msg, setMsg] = useState("黑先。点交叉点落子。");
  const [human, setHuman] = useState<Stone>(1);
  const [thinking, setThinking] = useState(false);
  const [passes, setPasses] = useState(0);
  const busy = useRef(false);

  const scoreNow = useMemo(() => score(board), [board]);

  const step = useCallback(
    (i: number) => {
      const nb = play(board, i, side);
      if (!nb) {
        setMsg("这里不能下。");
        return;
      }
      const prevKey = history.length ? key(history[history.length - 1]) : "";
      if (key(nb) === prevKey) {
        setMsg("打劫，换一处下。");
        return;
      }
      setHistory((h) => [...h, board]);
      setBoard(nb);
      setLast(i);
      setPasses(0);
      setSide(side === 1 ? 2 : 1);
      setMsg(side === 1 ? "轮到白方。" : "轮到黑方。");
    },
    [board, side, history]
  );

  useEffect(() => {
    if (busy.current || side === human) return;
    busy.current = true;
    setThinking(true);
    const t = setTimeout(() => {
      try {
        const banned = history.length ? key(history[history.length - 1]) : "";
        const mv = aiPick(board, side, banned);
        if (mv === null) {
          setMsg("对方停一手。");
          setSide(side === 1 ? 2 : 1);
        } else {
          const nb = play(board, mv, side)!;
          setHistory((h) => [...h, board]);
          setBoard(nb);
          setLast(mv);
          setSide(side === 1 ? 2 : 1);
          setMsg(side === 1 ? "轮到白方。" : "轮到黑方。");
        }
      } finally {
        setThinking(false);
        busy.current = false;
      }
    }, 80);
    return () => {
      clearTimeout(t);
      busy.current = false;
      setThinking(false);
    };
  }, [board, side, human, history]);

  const pass = () => {
    if (side !== human) return;
    const p = passes + 1;
    setPasses(p);
    if (p >= 2) {
      const b = scoreNow.black;
      const w = scoreNow.white + KOMI;
      setMsg(
        b === w
          ? `终局。黑 ${b} 对白 ${w}，和棋。`
          : b > w
          ? `终局。黑 ${b} 对白 ${w}，黑胜 ${(b - w).toFixed(1)}。`
          : `终局。黑 ${b} 对白 ${w}，白胜 ${(w - b).toFixed(1)}。`
      );
      return;
    }
    setSide(side === 1 ? 2 : 1);
    setMsg("你停一手。");
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const back = h.length >= 2 ? h.slice(0, -2) : h.slice(0, -1);
      setBoard(back.length ? back[back.length - 1] : (new Array(NN).fill(0) as Board));
      setSide(human);
      setLast(-1);
      setMsg("悔一步。");
      return back;
    });
  };

  const reset = (s: Stone) => {
    setBoard(new Array(NN).fill(0) as Board);
    setSide(1);
    setHistory([]);
    setLast(-1);
    setHuman(s);
    setPasses(0);
    setMsg(s === 1 ? "黑先。点交叉点落子。" : "你执白，黑方先走。");
  };

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>{thinking ? "对方在想…" : msg}</span>
        <span>黑 {scoreNow.black} · 白 {scoreNow.white}+{KOMI}</span>
      </div>

      <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
        <svg viewBox={`0 0 ${SIDE} ${SIDE}`} className="absolute inset-0 h-full w-full">
          <rect x="0" y="0" width={SIDE} height={SIDE} fill="#E8DEC6" />
          {Array.from({ length: N }).map((_, r) => (
            <line key={`h${r}`} x1={px(0)} y1={py(r)} x2={px(N - 1)} y2={py(r)} stroke="#7d6a4c" strokeWidth="1.4" />
          ))}
          {Array.from({ length: N }).map((_, c) => (
            <line key={`v${c}`} x1={px(c)} y1={py(0)} x2={px(c)} y2={py(N - 1)} stroke="#7d6a4c" strokeWidth="1.4" />
          ))}
          {[[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]].map(([r, c]) => (
            <circle key={`s${r}${c}`} cx={px(c)} cy={py(r)} r="3.4" fill="#7d6a4c" />
          ))}
        </svg>

        {Array.from({ length: NN }).map((_, i) => (
          <button
            key={i}
            onClick={() => side === human && !thinking && step(i)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition"
            style={{
              left: `${(px(col(i)) / SIDE) * 100}%`,
              top: `${(py(row(i)) / SIDE) * 100}%`,
              width: `${(GAP * 0.92 / SIDE) * 100}%`,
              aspectRatio: "1 / 1",
            }}
          >
            {board[i] !== 0 && (
              <span
                className={[
                  "block h-full w-full rounded-full",
                  board[i] === 1
                    ? "bg-[#2b2b2b] shadow-[inset_-2px_-2px_4px_rgba(255,255,255,.18)]"
                    : "bg-[#f7f5ee] shadow-[inset_-2px_-2px_4px_rgba(0,0,0,.16)]",
                  i === last ? "ring-2 ring-pollen" : "",
                ].join(" ")}
              />
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => reset(1)} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">执黑重开</button>
        <button onClick={() => reset(2)} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">执白重开</button>
        <button onClick={undo} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">悔棋</button>
        <button onClick={pass} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">停一手</button>
      </div>
      <p className="mt-3 text-xs text-muted">9 路盘。中国规则数目，白贴 6.5 目，双方停手即终局。</p>
    </div>
  );
}
