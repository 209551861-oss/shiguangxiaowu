"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Side = "r" | "b";
type Kind = "K" | "A" | "B" | "N" | "R" | "C" | "P";
type Piece = { t: Kind; s: Side };
type Board = (Piece | null)[];
type Move = { from: number; to: number };

const CN: Record<Side, Record<Kind, string>> = {
  r: { K: "帅", A: "仕", B: "相", N: "马", R: "车", C: "炮", P: "兵" },
  b: { K: "将", A: "士", B: "象", N: "马", R: "车", C: "炮", P: "卒" },
};

const VALUE: Record<Kind, number> = { K: 10000, R: 900, C: 450, N: 400, B: 200, A: 200, P: 100 };
const START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR";

const GAP = 87.5;
const PAD = 50;
const W = PAD * 2 + GAP * 8;
const H = PAD * 2 + GAP * 9;

const row = (i: number) => Math.floor(i / 9);
const col = (i: number) => i % 9;
const at = (r: number, c: number) => r * 9 + c;
const inBoard = (r: number, c: number) => r >= 0 && r < 10 && c >= 0 && c < 9;
const px = (c: number) => PAD + c * GAP;
const py = (r: number) => PAD + r * GAP;

function parseFen(fen: string): Board {
  const b: Board = new Array(90).fill(null);
  fen.split("/").forEach((line, r) => {
    let c = 0;
    for (const ch of line) {
      if (/\d/.test(ch)) c += Number(ch);
      else {
        const up = ch.toUpperCase() as Kind;
        b[at(r, c)] = { t: up, s: ch === up ? "r" : "b" };
        c++;
      }
    }
  });
  return b;
}

const START = parseFen(START_FEN);

function inPalace(s: Side, r: number, c: number) {
  if (c < 3 || c > 5) return false;
  return s === "r" ? r >= 7 : r <= 2;
}

function genMoves(b: Board, side: Side): Move[] {
  const out: Move[] = [];
  const push = (from: number, r: number, c: number) => {
    if (!inBoard(r, c)) return;
    const t = b[at(r, c)];
    if (t && t.s === side) return;
    out.push({ from, to: at(r, c) });
  };

  for (let i = 0; i < 90; i++) {
    const p = b[i];
    if (!p || p.s !== side) continue;
    const r = row(i), c = col(i);

    if (p.t === "K") {
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        if (inPalace(side, r + dr, c + dc)) push(i, r + dr, c + dc);
      }
    } else if (p.t === "A") {
      for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (inPalace(side, r + dr, c + dc)) push(i, r + dr, c + dc);
      }
    } else if (p.t === "B") {
      for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
        const nr = r + dr, nc = c + dc;
        if (!inBoard(nr, nc)) continue;
        if (side === "r" ? nr < 5 : nr > 4) continue;
        if (b[at(r + dr / 2, c + dc / 2)]) continue;
        push(i, nr, nc);
      }
    } else if (p.t === "N") {
      const steps: [number, number, number, number][] = [
        [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1],
      ];
      for (const [dr, dc, br, bc] of steps) {
        const nr = r + dr, nc = c + dc;
        if (!inBoard(nr, nc)) continue;
        if (b[at(r + br, c + bc)]) continue;
        push(i, nr, nc);
      }
    } else if (p.t === "R" || p.t === "C") {
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        let nr = r + dr, nc = c + dc;
        let jumped = false;
        while (inBoard(nr, nc)) {
          const t = b[at(nr, nc)];
          if (p.t === "R") {
            if (!t) out.push({ from: i, to: at(nr, nc) });
            else {
              if (t.s !== side) out.push({ from: i, to: at(nr, nc) });
              break;
            }
          } else {
            if (!jumped) {
              if (!t) out.push({ from: i, to: at(nr, nc) });
              else jumped = true;
            } else if (t) {
              if (t.s !== side) out.push({ from: i, to: at(nr, nc) });
              break;
            }
          }
          nr += dr; nc += dc;
        }
      }
    } else if (p.t === "P") {
      const fwd = side === "r" ? -1 : 1;
      push(i, r + fwd, c);
      const crossed = side === "r" ? r <= 4 : r >= 5;
      if (crossed) {
        push(i, r, c - 1);
        push(i, r, c + 1);
      }
    }
  }
  return out;
}

function kingPos(b: Board, s: Side): number {
  for (let i = 0; i < 90; i++) {
    const p = b[i];
    if (p && p.t === "K" && p.s === s) return i;
  }
  return -1;
}

/** 将所在格是否被 by 方攻击（直接扫描，不生成走法） */
function attacked(b: Board, k: number, by: Side): boolean {
  const kr = row(k), kc = col(k);

  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    let nr = kr + dr, nc = kc + dc;
    let blocker = false;
    while (inBoard(nr, nc)) {
      const p = b[at(nr, nc)];
      if (p) {
        if (!blocker) {
          if (p.s === by && (p.t === "R" || p.t === "K")) return true;
          blocker = true;
        } else {
          if (p.s === by && p.t === "C") return true;
          break;
        }
      }
      nr += dr; nc += dc;
    }
  }

  const horse: [number, number, number, number][] = [
    [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
    [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1],
  ];
  for (const [dr, dc, br, bc] of horse) {
    const nr = kr + dr, nc = kc + dc;
    if (!inBoard(nr, nc)) continue;
    const p = b[at(nr, nc)];
    if (p && p.s === by && p.t === "N" && !b[at(kr + br, kc + bc)]) return true;
  }

  const pawnDirs: [number, number][] = by === "r" ? [[1, 0], [0, 1], [0, -1]] : [[-1, 0], [0, 1], [0, -1]];
  for (const [dr, dc] of pawnDirs) {
    const nr = kr + dr, nc = kc + dc;
    if (!inBoard(nr, nc)) continue;
    const p = b[at(nr, nc)];
    if (p && p.s === by && p.t === "P") return true;
  }
  return false;
}

function inCheck(b: Board, s: Side): boolean {
  const k = kingPos(b, s);
  if (k < 0) return true;
  return attacked(b, k, s === "r" ? "b" : "r");
}

function applyMove(b: Board, m: Move): Board {
  const nb = b.slice();
  nb[m.to] = nb[m.from];
  nb[m.from] = null;
  return nb;
}

function legalMoves(b: Board, s: Side): Move[] {
  return genMoves(b, s).filter((m) => !inCheck(applyMove(b, m), s));
}

function evaluate(b: Board, side: Side): number {
  let score = 0;
  for (let i = 0; i < 90; i++) {
    const p = b[i];
    if (!p) continue;
    let v = VALUE[p.t];
    const r = row(i), c = col(i);
    if (p.t === "P" && (p.s === "r" ? r <= 4 : r >= 5)) v += 60;
    if ((p.t === "N" || p.t === "C") && c >= 2 && c <= 6) v += 15;
    score += p.s === side ? v : -v;
  }
  return score;
}

function search(b: Board, side: Side, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return evaluate(b, side);
  const moves = legalMoves(b, side);
  if (!moves.length) return -9000;
  moves.sort((a, z) => (b[z.to] ? VALUE[b[z.to]!.t] : 0) - (b[a.to] ? VALUE[b[a.to]!.t] : 0));
  let best = -Infinity;
  for (const m of moves) {
    const score = -search(applyMove(b, m), side === "r" ? "b" : "r", depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function bestMove(b: Board, side: Side, depth: number): Move | null {
  const moves = legalMoves(b, side);
  if (!moves.length) return null;
  moves.sort((a, z) => (b[z.to] ? VALUE[b[z.to]!.t] : 0) - (b[a.to] ? VALUE[b[a.to]!.t] : 0));
  let best = -Infinity;
  let pick: Move | null = null;
  for (const m of moves) {
    const score = -search(applyMove(b, m), side === "r" ? "b" : "r", depth - 1, -Infinity, -best);
    if (score > best) {
      best = score;
      pick = m;
    }
  }
  return pick;
}

export default function Xiangqi() {
  const [board, setBoard] = useState<Board>(START);
  const [side, setSide] = useState<Side>("r");
  const [sel, setSel] = useState(-1);
  const [depth, setDepth] = useState(2);
  const [thinking, setThinking] = useState(false);
  const [msg, setMsg] = useState("红先。点子，再点落点。");
  const [history, setHistory] = useState<Board[]>([]);
  const [humanSide, setHumanSide] = useState<Side>("r");
  const quiet = useRef(0);
  const keys = useRef<string[]>([]);
  const busy = useRef(false);

  const targets = useMemo(() => {
    if (sel < 0) return new Set<number>();
    return new Set(legalMoves(board, side).filter((m) => m.from === sel).map((m) => m.to));
  }, [board, side, sel]);

  const settle = useCallback((nb: Board, next: Side, note?: string) => {
    setBoard(nb);
    setSide(next);
    setSel(-1);

    const captured = nb.filter(Boolean).length < board.filter(Boolean).length;
    quiet.current = captured ? 0 : quiet.current + 1;
    const k = nb.map((p) => (p ? p.s + p.t : ".")).join("") + next;
    const reps = keys.current.filter((x) => x === k).length + 1;
    keys.current = [...keys.current, k];
    const q = quiet.current;

    const legal = legalMoves(nb, next);
    if (!legal.length) {
      setMsg(`${next === "r" ? "红" : "黑"}方无棋可走，${next === "r" ? "黑" : "红"}胜。`);
    } else if (q >= 120) {
      setMsg("60 回合没吃子，和棋。");
    } else if (reps >= 3) {
      setMsg("同一局面出现三次，和棋。");
    } else if (inCheck(nb, next)) {
      setMsg(`将军。${note ?? ""}`);
    } else {
      setMsg(note ?? (next === "r" ? "轮到红方。" : "轮到黑方。"));
    }
  }, [board]);

  const doMove = useCallback(
    (from: number, to: number) => {
      setHistory((h) => [...h, board]);
      settle(applyMove(board, { from, to }), side === "r" ? "b" : "r");
    },
    [board, side, settle]
  );

  useEffect(() => {
    if (busy.current || side === humanSide) return;
    if (!legalMoves(board, side).length) return;
    busy.current = true;
    setThinking(true);
    const t = setTimeout(() => {
      try {
        const mv = bestMove(board, side, depth);
        if (mv) {
          setHistory((h) => [...h, board]);
          settle(applyMove(board, mv), side === "r" ? "b" : "r", "黑走完了。");
        }
      } finally {
        setThinking(false);
        busy.current = false;
      }
    }, 60);
    return () => {
      clearTimeout(t);
      busy.current = false;
      setThinking(false);
    };
  }, [board, side, depth, humanSide, settle]);

  const onCell = (i: number) => {
    if (thinking || side !== humanSide) return;
    const p = board[i];
    if (p && p.s === humanSide) {
      setSel(i);
      return;
    }
    if (sel >= 0 && targets.has(i)) doMove(sel, i);
    else setSel(-1);
  };

  const undo = () => {
    if (!history.length) return;
    // 退两步：玩家一步 + 电脑一步。目标局面是「玩家这一步之前」那个
    const target = history.length >= 2 ? history[history.length - 2] : START;
    setHistory((h) => (h.length >= 2 ? h.slice(0, -2) : []));
    setBoard(target);
    setSide(humanSide);
    setSel(-1);
    setMsg("悔一步。");
  };

  const reset = (s: Side) => {
    setBoard(START);
    setSide("r");
    setSel(-1);
    setHistory([]);
    quiet.current = 0;
    keys.current = [];
    setHumanSide(s);
    setMsg(s === "r" ? "红先。点子，再点落点。" : "你执黑，红方先走。");
  };

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>{thinking ? "对方在想…" : msg}</span>
        <span>深度 {depth}</span>
      </div>

      <div className="relative w-full select-none" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
          <rect x="0" y="0" width={W} height={H} fill="rgba(255,254,250,.7)" />
          {Array.from({ length: 10 }).map((_, r) => (
            <line key={`h${r}`} x1={px(0)} y1={py(r)} x2={px(8)} y2={py(r)} stroke="#8a8a76" strokeWidth="2" />
          ))}
          {Array.from({ length: 9 }).map((_, c) =>
            c === 0 || c === 8 ? (
              <line key={`v${c}`} x1={px(c)} y1={py(0)} x2={px(c)} y2={py(9)} stroke="#8a8a76" strokeWidth="2" />
            ) : (
              <g key={`v${c}`}>
                <line x1={px(c)} y1={py(0)} x2={px(c)} y2={py(4)} stroke="#8a8a76" strokeWidth="2" />
                <line x1={px(c)} y1={py(5)} x2={px(c)} y2={py(9)} stroke="#8a8a76" strokeWidth="2" />
              </g>
            )
          )}
          <line x1={px(3)} y1={py(0)} x2={px(5)} y2={py(2)} stroke="#8a8a76" strokeWidth="2" />
          <line x1={px(5)} y1={py(0)} x2={px(3)} y2={py(2)} stroke="#8a8a76" strokeWidth="2" />
          <line x1={px(3)} y1={py(7)} x2={px(5)} y2={py(9)} stroke="#8a8a76" strokeWidth="2" />
          <line x1={px(5)} y1={py(7)} x2={px(3)} y2={py(9)} stroke="#8a8a76" strokeWidth="2" />
          <text x={W / 2} y={py(4.5)} textAnchor="middle" fontSize="24" fill="#9a9a86" fontFamily="serif" letterSpacing="12">楚 河　汉 界</text>
        </svg>

        {board.map((p, i) => {
          if (!p) return null;
          return (
            <button
              key={i}
              onClick={() => onCell(i)}
              className={[
                "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-serif shadow-sm transition",
                p.s === "r" ? "border-red-700 bg-paper text-red-700" : "border-ink bg-paper text-ink",
                i === sel ? "ring-2 ring-pollen" : "",
              ].join(" ")}
              style={{
                left: `${(px(col(i)) / W) * 100}%`,
                top: `${(py(row(i)) / H) * 100}%`,
                width: `${(GAP * 0.92 / W) * 100}%`,
                aspectRatio: "1 / 1",
              }}
            >
              <span className="text-[clamp(13px,3.2vw,20px)] leading-none">{CN[p.s][p.t]}</span>
            </button>
          );
        })}

        {[...targets].map((t) => (
          <button
            key={`t${t}`}
            onClick={() => onCell(t)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-leaf/60"
            style={{
              left: `${(px(col(t)) / W) * 100}%`,
              top: `${(py(row(t)) / H) * 100}%`,
              width: `${(GAP * 0.34 / W) * 100}%`,
              aspectRatio: "1 / 1",
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => reset("r")} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">执红重开</button>
        <button onClick={() => reset("b")} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">执黑重开</button>
        <button onClick={undo} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">悔棋</button>
        <button
          onClick={() => setDepth((d) => (d >= 3 ? 1 : d + 1))}
          className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest"
        >
          难度 {depth}
        </button>
      </div>
    </div>
  );
}
