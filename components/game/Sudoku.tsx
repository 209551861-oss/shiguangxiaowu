"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Level = "easy" | "medium" | "hard";

const LEVELS: Record<Level, number> = { easy: 42, medium: 34, hard: 28 };
const LEVEL_LABEL: Record<Level, string> = { easy: "简单", medium: "中等", hard: "困难" };
const STORE_KEY = "shiguang:sudoku:v1";

const idx = (r: number, c: number) => r * 9 + c;

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlace(b: number[], p: number, v: number) {
  const r = Math.floor(p / 9);
  const c = p % 9;
  for (let i = 0; i < 9; i++) {
    if (b[idx(r, i)] === v) return false;
    if (b[idx(i, c)] === v) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) if (b[idx(br + i, bc + j)] === v) return false;
  return true;
}

function fill(b: number[], pos = 0): boolean {
  if (pos === 81) return true;
  if (b[pos]) return fill(b, pos + 1);
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(b, pos, v)) {
      b[pos] = v;
      if (fill(b, pos + 1)) return true;
      b[pos] = 0;
    }
  }
  return false;
}

function countSolutions(b: number[], limit = 2): number {
  let count = 0;
  const go = (pos: number) => {
    if (count >= limit) return;
    while (pos < 81 && b[pos]) pos++;
    if (pos === 81) {
      count++;
      return;
    }
    for (let v = 1; v <= 9; v++) {
      if (canPlace(b, pos, v)) {
        b[pos] = v;
        go(pos + 1);
        b[pos] = 0;
        if (count >= limit) return;
      }
    }
  };
  go(0);
  return count;
}

function makePuzzle(clues: number) {
  const full = new Array(81).fill(0);
  fill(full);
  const solution = full.slice();
  const p = full.slice();
  const order = shuffle([...Array(81).keys()]);
  let filled = 81;
  for (const pos of order) {
    if (filled <= clues) break;
    const backup = p[pos];
    p[pos] = 0;
    if (countSolutions(p.slice()) !== 1) p[pos] = backup;
    else filled--;
  }
  return { puzzle: p, solution };
}

function peersOf(i: number): Set<number> {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const s = new Set<number>();
  for (let k = 0; k < 9; k++) {
    s.add(idx(r, k));
    s.add(idx(k, c));
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s.add(idx(br + a, bc + b));
  s.delete(i);
  return s;
}

function findConflicts(board: number[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const v = board[i];
    if (!v) continue;
    for (const j of peersOf(i)) if (board[j] === v) {
      bad.add(i);
      bad.add(j);
    }
  }
  return bad;
}

export default function Sudoku() {
  const [level, setLevel] = useState<Level>("medium");
  const [puzzle, setPuzzle] = useState<number[]>([]);
  const [solution, setSolution] = useState<number[]>([]);
  const [board, setBoard] = useState<number[]>([]);
  const [notes, setNotes] = useState<Set<number>[]>([]);
  const [sel, setSel] = useState(-1);
  const [noteMode, setNoteMode] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("点一格，输数字。");
  const startedAt = useRef<number | null>(null);

  const fixed = useMemo(() => puzzle.map((v) => v !== 0), [puzzle]);

  const newGame = useCallback((lv: Level) => {
    const { puzzle: p, solution: s } = makePuzzle(LEVELS[lv]);
    setLevel(lv);
    setPuzzle(p);
    setSolution(s);
    setBoard(p.slice());
    setNotes(Array.from({ length: 81 }, () => new Set<number>()));
    setSel(-1);
    setDone(false);
    setRunning(false);
    setSeconds(0);
    startedAt.current = null;
    setMsg("点一格，输数字。");
  }, []);

  // 首次挂载：读存档，没有就开新局
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.board) && d.board.length === 81 && Array.isArray(d.solution)) {
          setLevel(d.level ?? "medium");
          setPuzzle(d.puzzle);
          setSolution(d.solution);
          setBoard(d.board);
          setNotes(
            Array.isArray(d.notes) && d.notes.length === 81
              ? d.notes.map((n: number[]) => new Set(n))
              : Array.from({ length: 81 }, () => new Set<number>())
          );
          setSeconds(d.seconds ?? 0);
          setDone(!!d.done);
          setMsg(d.done ? "这盘已经完成了。" : "接着上次的盘。");
          return;
        }
      }
    } catch {
      /* 存档坏了就重开 */
    }
    newGame("medium");
  }, [newGame]);

  // 计时
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // 存盘
  useEffect(() => {
    if (!board.length) return;
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          level,
          puzzle,
          solution,
          board,
          notes: notes.map((n) => [...n]),
          seconds,
          done,
        })
      );
    } catch {
      /* 空间满了就算了 */
    }
  }, [level, puzzle, solution, board, notes, seconds, done]);

  const conflicts = useMemo(() => findConflicts(board), [board]);
  const peerSet = useMemo(() => (sel >= 0 ? peersOf(sel) : new Set<number>()), [sel]);

  const step = useCallback(
    (v: number) => {
      if (sel < 0 || done || puzzle.length === 0) return;
      if (fixed[sel]) return;

      if (noteMode) {
        setNotes((prev) => {
          const next = prev.map((n) => new Set(n));
          if (board[sel]) return prev;
          if (next[sel].has(v)) next[sel].delete(v);
          else next[sel].add(v);
          return next;
        });
        return;
      }

      const next = board.slice();
      next[sel] = next[sel] === v ? 0 : v;
      setBoard(next);
      if (next[sel]) {
        setNotes((prev) => {
          const n2 = prev.map((n) => new Set(n));
          n2[sel].clear();
          return n2;
        });
      }
      if (!running) {
        startedAt.current = Date.now();
        setRunning(true);
      }
      if (next.every((x) => x !== 0) && findConflicts(next).size === 0) {
        setDone(true);
        setRunning(false);
        setMsg(`完成了，用时 ${fmt(seconds)}。`);
      }
    },
    [sel, done, puzzle, fixed, noteMode, board, running, seconds]
  );

  const erase = useCallback(() => {
    if (sel < 0 || done || fixed[sel]) return;
    const next = board.slice();
    next[sel] = 0;
    setBoard(next);
    setNotes((prev) => {
      const n2 = prev.map((n) => new Set(n));
      n2[sel].clear();
      return n2;
    });
  }, [sel, done, fixed, board]);

  const hint = useCallback(() => {
    if (done) return;
    const empties = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (!empties.length) return;
    const i = empties[Math.floor(Math.random() * empties.length)];
    const next = board.slice();
    next[i] = solution[i];
    setBoard(next);
    setNotes((prev) => {
      const n2 = prev.map((n) => new Set(n));
      n2[i].clear();
      return n2;
    });
    setSel(i);
    if (!running) setRunning(true);
    if (next.every((x) => x !== 0) && findConflicts(next).size === 0) {
      setDone(true);
      setRunning(false);
      setMsg(`完成了，用时 ${fmt(seconds)}。`);
    }
  }, [done, board, solution, running, seconds]);

  const check = useCallback(() => {
    if (conflicts.size) setMsg(`有 ${conflicts.size} 个格子重复，标红了。`);
    else setMsg("现在没有冲突。");
  }, [conflicts]);

  // 键盘
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "9") {
        step(Number(e.key));
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        erase();
        return;
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        if (sel < 0) return setSel(0);
        const r = Math.floor(sel / 9);
        const c = sel % 9;
        const d: Record<string, [number, number]> = {
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
        };
        const [dr, dc] = d[e.key];
        setSel(idx(Math.min(8, Math.max(0, r + dr)), Math.min(8, Math.max(0, c + dc))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, erase, sel]);

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="mb-4 flex items-baseline justify-between text-sm text-muted">
        <span className="font-mono tabular-nums">{fmt(seconds)}</span>
        <span>{LEVEL_LABEL[level]}</span>
      </div>

      <div className="grid grid-cols-9 border-2 border-forest bg-paper shadow-soft">
        {board.map((v, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const isFixed = fixed[i];
          const bad = conflicts.has(i);
          return (
            <button
              key={i}
              onClick={() => setSel(i)}
              className={[
                "relative flex aspect-square items-center justify-center text-xl transition",
                "border-line",
                c % 9 !== 8 ? "border-r" : "",
                r !== 8 ? "border-b" : "",
                (c === 2 || c === 5) ? "border-r-2 !border-forest" : "",
                (r === 2 || r === 5) ? "border-b-2 !border-forest" : "",
                i === sel ? "bg-pollen/40" : peerSet.has(i) ? "bg-leaf/10" : "hover:bg-mist",
                isFixed ? "font-semibold text-ink" : "text-leaf",
                bad ? "!text-red-600" : "",
              ].join(" ")}
            >
              {v ? (
                v
              ) : notes[i]?.size ? (
                <span className="absolute inset-0 grid grid-cols-3 grid-rows-3 text-[9px] text-muted">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
                    <span key={k} className="flex items-center justify-center">
                      {notes[i].has(k) ? k : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-9 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
          <button
            key={v}
            onClick={() => step(v)}
            className="rounded-pill border border-line bg-paper py-2 text-base text-ink transition hover:border-forest hover:text-forest"
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => newGame(level === "easy" ? "medium" : level === "medium" ? "hard" : "easy")}
          className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest"
        >
          新局
        </button>
        <button
          onClick={() => setNoteMode((v) => !v)}
          className={[
            "rounded-pill border px-4 py-2 text-sm transition",
            noteMode
              ? "border-forest bg-forest text-paper"
              : "border-line text-ink hover:border-forest hover:text-forest",
          ].join(" ")}
        >
          笔记 {noteMode ? "开" : "关"}
        </button>
        <button
          onClick={hint}
          className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest"
        >
          提示
        </button>
        <button
          onClick={check}
          className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest"
        >
          检查
        </button>
        <button
          onClick={erase}
          className="rounded-pill border border-line px-4 py-2 text-sm text-ink transition hover:border-forest hover:text-forest"
        >
          擦除
        </button>
      </div>

      <p className={["mt-3 min-h-[20px] text-xs", done ? "text-leaf" : "text-muted"].join(" ")}>
        {msg}
      </p>
    </div>
  );
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
