"use client";

import { useState } from "react";
import Sudoku from "./Sudoku";
import Chess from "./Chess";
import Xiangqi from "./Xiangqi";
import Go9 from "./Go9";

const TABS = [
  { key: "sudoku", label: "数独" },
  { key: "xiangqi", label: "中国象棋" },
  { key: "chess", label: "国际象棋" },
  { key: "go", label: "围棋 9 路" },
] as const;

type Key = (typeof TABS)[number]["key"];

export default function GameTabs() {
  const [tab, setTab] = useState<Key>("sudoku");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "rounded-pill border px-4 py-2 text-sm transition",
              tab === t.key
                ? "border-forest bg-forest text-paper"
                : "border-line text-ink hover:border-forest hover:text-forest",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sudoku" && <Sudoku />}
      {tab === "xiangqi" && <Xiangqi />}
      {tab === "chess" && <Chess />}
      {tab === "go" && <Go9 />}
    </div>
  );
}
