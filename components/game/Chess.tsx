"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Color = "w" | "b";
type Kind = "P" | "N" | "B" | "R" | "Q" | "K";
type Piece = { t: Kind; s: Color };
type Board = (Piece | null)[];
type Flag = "castleK" | "castleQ" | "ep";
type Move = { from: number; to: number; promo?: Kind; flag?: Flag };
type Castling = { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
type State = { board: Board; side: Color; castling: Castling; ep: number; half: number };

const GLYPH: Record<Color, Record<Kind, string>> = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

const VALUE: Record<Kind, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

const row = (i: number) => Math.floor(i / 8);
const col = (i: number) => i % 8;
const sq = (r: number, c: number) => r * 8 + c;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other = (s: Color): Color => (s === "w" ? "b" : "w");

function parseFen(fen: string): Board {
  const b: Board = new Array(64).fill(null);
  fen.split("/").forEach((line, r) => {
    let c = 0;
    for (const ch of line) {
      if (/\d/.test(ch)) c += Number(ch);
      else {
        const up = ch.toUpperCase() as Kind;
        b[sq(r, c)] = { t: up, s: ch === up ? "w" : "b" };
        c++;
      }
    }
  });
  return b;
}

const INITIAL: State = {
  board: parseFen(START_FEN),
  side: "w",
  castling: { wk: true, wq: true, bk: true, bq: true },
  ep: -1,
  half: 0,
};

function clone(s: State): State {
  return {
    board: s.board.slice(),
    side: s.side,
    castling: { ...s.castling },
    ep: s.ep,
    half: s.half,
  };
}

function genPseudo(st: State, side: Color): Move[] {
  const b = st.board;
  const out: Move[] = [];
  const push = (from: number, r: number, c: number, promo?: Kind) => {
    if (!inside(r, c)) return;
    const t = b[sq(r, c)];
    if (t && t.s === side) return;
    out.push({ from, to: sq(r, c), promo });
  };

  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || p.s !== side) continue;
    const r = row(i), c = col(i);

    if (p.t === "P") {
      const dir = side === "w" ? -1 : 1;
      const startRow = side === "w" ? 6 : 1;
      const promoRow = side === "w" ? 0 : 7;
      if (inside(r + dir, c) && !b[sq(r + dir, c)]) {
        if (r + dir === promoRow) {
          for (const k of ["Q", "R", "B", "N"] as Kind[]) out.push({ from: i, to: sq(r + dir, c), promo: k });
        } else {
          out.push({ from: i, to: sq(r + dir, c) });
          if (r === startRow && !b[sq(r + 2 * dir, c)]) out.push({ from: i, to: sq(r + 2 * dir, c) });
        }
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (!inside(nr, nc)) continue;
        const t = b[sq(nr, nc)];
        const isEp = st.ep === sq(nr, nc);
        if (t && t.s !== side) {
          if (nr === promoRow) for (const k of ["Q", "R", "B", "N"] as Kind[]) out.push({ from: i, to: sq(nr, nc), promo: k });
          else out.push({ from: i, to: sq(nr, nc) });
        } else if (!t && isEp) {
          out.push({ from: i, to: sq(nr, nc), flag: "ep" });
        }
      }
    } else if (p.t === "N") {
      for (const [dr, dc] of [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]]) {
        push(i, r + dr, c + dc);
      }
    } else if (p.t === "K") {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          push(i, r + dr, c + dc);
        }
    } else {
      const dirs: [number, number][] =
        p.t === "B" ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] :
        p.t === "R" ? [[0, 1], [0, -1], [1, 0], [-1, 0]] :
        [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (inside(nr, nc)) {
          const t = b[sq(nr, nc)];
          if (!t) out.push({ from: i, to: sq(nr, nc) });
          else {
            if (t.s !== side) out.push({ from: i, to: sq(nr, nc) });
            break;
          }
          nr += dr; nc += dc;
        }
      }
    }
  }

  // 王车易位（只生成，合法性在 legalMoves 里复核）
  if (side === "w") {
    if (st.castling.wk && b[60]?.t === "K" && b[63]?.t === "R" && !b[61] && !b[62]) out.push({ from: 60, to: 62, flag: "castleK" });
    if (st.castling.wq && b[60]?.t === "K" && b[56]?.t === "R" && !b[57] && !b[58] && !b[59]) out.push({ from: 60, to: 58, flag: "castleQ" });
  } else {
    if (st.castling.bk && b[4]?.t === "K" && b[7]?.t === "R" && !b[5] && !b[6]) out.push({ from: 4, to: 6, flag: "castleK" });
    if (st.castling.bq && b[4]?.t === "K" && b[0]?.t === "R" && !b[1] && !b[2] && !b[3]) out.push({ from: 4, to: 2, flag: "castleQ" });
  }

  return out;
}

function findKing(b: Board, s: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p && p.t === "K" && p.s === s) return i;
  }
  return -1;
}

function attacked(b: Board, target: number, by: Color): boolean {
  const st: State = { board: b, side: by, castling: { wk: false, wq: false, bk: false, bq: false }, ep: -1, half: 0 };
  for (const m of genPseudo(st, by)) if (m.to === target) return true;
  return false;
}

function inCheck(st: State, s: Color): boolean {
  const k = findKing(st.board, s);
  return k >= 0 && attacked(st.board, k, other(s));
}

function applyMove(st: State, m: Move): State {
  const ns = clone(st);
  const b = ns.board;
  const moving = b[m.from];
  b[m.to] = m.promo && moving ? { t: m.promo, s: moving.s } : moving;
  b[m.from] = null;

  if (m.flag === "ep") {
    const dir = moving?.s === "w" ? 1 : -1;
    b[m.to + dir * 8] = null;
  }
  if (m.flag === "castleK") {
    const base = moving?.s === "w" ? 60 : 4;
    b[base + 1] = b[base + 3];
    b[base + 3] = null;
  }
  if (m.flag === "castleQ") {
    const base = moving?.s === "w" ? 60 : 4;
    b[base - 1] = b[base - 4];
    b[base - 4] = null;
  }

  // 易位权
  if (moving?.t === "K") {
    if (moving.s === "w") { ns.castling.wk = false; ns.castling.wq = false; }
    else { ns.castling.bk = false; ns.castling.bq = false; }
  }
  if (m.from === 63 || m.to === 63) ns.castling.wk = false;
  if (m.from === 56 || m.to === 56) ns.castling.wq = false;
  if (m.from === 7 || m.to === 7) ns.castling.bk = false;
  if (m.from === 0 || m.to === 0) ns.castling.bq = false;

  // 过路兵目标格
  ns.ep = -1;
  if (moving?.t === "P" && Math.abs(row(m.to) - row(m.from)) === 2) {
    ns.ep = (m.from + m.to) / 2;
  }

  // 半回合计数：兵动或吃子清零
  const captured = st.board[m.to] !== null || m.flag === "ep";
  ns.half = moving?.t === "P" || captured ? 0 : st.half + 1;
  ns.side = other(st.side);
  return ns;
}

function legalMoves(st: State, side: Color): Move[] {
  const out: Move[] = [];
  for (const m of genPseudo({ ...st, side }, side)) {
    if (m.flag === "castleK" || m.flag === "castleQ") {
      if (inCheck(st, side)) continue;
      const base = side === "w" ? 60 : 4;
      const step = m.flag === "castleK" ? 1 : -1;
      const mids = m.flag === "castleK" ? [base + 1, base + 2] : [base - 1, base - 2];
      if (mids.some((s) => attacked(st.board, s, other(side)))) continue;
      // 落点本身也要过"走后不被将军"
    }
    if (!inCheck(applyMove(st, m), side)) out.push(m);
  }
  return out;
}

function evaluate(b: Board, side: Color): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    let v = VALUE[p.t];
    const r = row(i), c = col(i);
    if (p.t !== "K") v += (3 - Math.abs(3.5 - r)) + (3 - Math.abs(3.5 - c)) * 2;
    score += p.s === side ? v : -v;
  }
  return score;
}

function search(st: State, side: Color, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return evaluate(st.board, side);
  const moves = legalMoves(st, side);
  if (!moves.length) return inCheck(st, side) ? -9000 : 0;
  moves.sort((a, z) => (st.board[z.to] ? VALUE[st.board[z.to]!.t] : 0) - (st.board[a.to] ? VALUE[st.board[a.to]!.t] : 0));
  let best = -Infinity;
  for (const m of moves) {
    const score = -search(applyMove(st, m), other(side), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function bestMove(st: State, side: Color, depth: number): Move | null {
  const moves = legalMoves(st, side);
  if (!moves.length) return null;
  moves.sort((a, z) => (st.board[z.to] ? VALUE[st.board[z.to]!.t] : 0) - (st.board[a.to] ? VALUE[st.board[a.to]!.t] : 0));
  let best = -Infinity;
  let pick: Move | null = null;
  for (const m of moves) {
    const score = -search(applyMove(st, m), other(side), depth - 1, -Infinity, -best);
    if (score > best) {
      best = score;
      pick = m;
    }
  }
  return pick;
}

function posKey(st: State) {
  return st.board.map((p) => (p ? (p.s === "w" ? p.t : p.t.toLowerCase()) : ".")).join("") + st.side;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const name = (i: number) => `${FILES[col(i)]}${8 - row(i)}`;

export default function Chess() {
  const [state, setState] = useState<State>(INITIAL);
  const [sel, setSel] = useState(-1);
  const [depth, setDepth] = useState(2);
  const [thinking, setThinking] = useState(false);
  const [msg, setMsg] = useState("白先。点棋子，再点落点。");
  const [history, setHistory] = useState<State[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [humanSide, setHumanSide] = useState<Color>("w");
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const busy = useRef(false);

  const board = state.board;
  const side = state.side;

  const targets = useMemo(() => {
    if (sel < 0) return new Map<number, Move>();
    const map = new Map<number, Move>();
    for (const m of legalMoves(state, side)) if (m.from === sel) map.set(m.to, m);
    return map;
  }, [state, side, sel]);

  const settle = useCallback(
    (ns: State, note: string | undefined, mv: Move) => {
      const next = ns.side;
      const k = posKey(ns);
      const repeat = keys.filter((x) => x === k).length + 1;
      let text: string;
      if (!legalMoves(ns, next).length) {
        text = inCheck(ns, next)
          ? `${next === "w" ? "白" : "黑"}被将死，${next === "w" ? "黑" : "白"}胜。`
          : "逼和，和棋。";
      } else if (ns.half >= 100) {
        text = "50 回合没吃子没动兵，和棋。";
      } else if (repeat >= 3) {
        text = "同一局面出现三次，和棋。";
      } else if (inCheck(ns, next)) {
        text = `将军。${note ?? ""}`;
      } else {
        text = note ?? (next === "w" ? "轮到白方。" : "轮到黑方。");
      }
      setState(ns);
      setKeys((ks) => [...ks, k]);
      setLastMove(mv);
      setSel(-1);
      setMsg(text);
    },
    [keys]
  );

  const doMove = useCallback(
    (m: Move) => {
      const ns = applyMove(state, m);
      setHistory((h) => [...h, state]);
      const label = m.flag === "castleK" ? "短易位" : m.flag === "castleQ" ? "长易位" : m.flag === "ep" ? "吃过路兵" : m.promo ? `升变为 ${m.promo}` : undefined;
      settle(ns, label, m);
    },
    [state, settle]
  );

  useEffect(() => {
    if (busy.current || side === humanSide) return;
    if (!legalMoves(state, side).length) return;
    busy.current = true;
    setThinking(true);
    const t = setTimeout(() => {
      try {
        const mv = bestMove(state, side, depth);
        if (mv) {
          const ns = applyMove(state, mv);
          setHistory((h) => [...h, state]);
          settle(ns, `对方 ${name(mv.from)}→${name(mv.to)}。`, mv);
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
  }, [state, side, depth, humanSide, settle]);

  const onCell = (i: number) => {
    if (thinking || side !== humanSide) return;
    const p = board[i];
    if (p && p.s === humanSide) {
      setSel(i);
      return;
    }
    const mv = targets.get(i);
    if (mv) doMove(mv);
    else setSel(-1);
  };

  const undo = () => {
    if (!history.length) return;
    const target = history.length >= 2 ? history[history.length - 2] : INITIAL;
    setHistory((h) => (h.length >= 2 ? h.slice(0, -2) : []));
    setState(target);
    setKeys((ks) => ks.slice(0, Math.max(0, ks.length - 1)));
    setSel(-1);
    setLastMove(null);
    setMsg("悔一步。");
  };

  const reset = (s: Color) => {
    setState(INITIAL);
    setSel(-1);
    setHistory([]);
    setKeys([]);
    setLastMove(null);
    setHumanSide(s);
    setMsg(s === "w" ? "白先。点棋子，再点落点。" : "你执黑，白方先走。");
  };

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>{thinking ? "对方在想…" : msg}</span>
        <span>深度 {depth}</span>
      </div>

      <div className="relative overflow-hidden rounded-sm border-2 border-forest">
        <div className="grid grid-cols-8">
          {board.map((p, i) => {
            const dark = (row(i) + col(i)) % 2 === 1;
            const isTarget = targets.has(i);
            return (
              <button
                key={i}
                onClick={() => onCell(i)}
                className={[
                  "relative flex aspect-square items-center justify-center",
                  dark ? "bg-[#b8c4ae]" : "bg-[#f3f1e6]",
                  lastMove && (i === lastMove.from || i === lastMove.to) ? "ring-2 ring-inset ring-pollen/70" : "",
                  i === sel ? "ring-2 ring-inset ring-forest" : "",
                  isTarget ? "after:absolute after:h-1/4 after:w-1/4 after:rounded-full after:bg-leaf/50" : "",
                ].join(" ")}
              >
                {p && (
                  <span
                    className={[
                      "select-none text-[clamp(20px,5.4vw,34px)] leading-none",
                      p.s === "w" ? "text-paper [text-shadow:0_0_2px_#394b3c]" : "text-ink",
                    ].join(" ")}
                  >
                    {GLYPH[p.s][p.t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => reset("w")} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">执白重开</button>
        <button onClick={() => reset("b")} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">执黑重开</button>
        <button onClick={undo} className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest">悔棋</button>
        <button
          onClick={() => setDepth((d) => (d >= 3 ? 1 : d + 1))}
          className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest"
        >
          难度 {depth}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">规则齐了：易位、吃过路兵、升变、50 回合、三次重复。</p>
    </div>
  );
}
