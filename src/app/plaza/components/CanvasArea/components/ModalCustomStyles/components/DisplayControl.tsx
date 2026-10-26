import React, { useState, useEffect, useCallback } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

type DisplayMode =
  "flex" | "grid" | "block" | "inline-block" | "inline" | "none";

interface Props {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

const DISPLAY_OPTIONS: { id: DisplayMode; label: string }[] = [
  { id: "flex", label: "flex" },
  { id: "grid", label: "grid" },
  { id: "block", label: "block" },
  { id: "inline-block", label: "inline-block" },
  { id: "inline", label: "inline" },
  { id: "none", label: "none" },
];

export function DisplayControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  const [activeDisplay, setActiveDisplay] = useState<DisplayMode | null>(null);

  // Текущие значения свойств внутри класса
  const [justifyVal, setJustifyVal] = useState<string | null>(null);
  const [alignVal, setAlignVal] = useState<string | null>(null);
  const [flexDir, setFlexDir] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<string | null>(null);
  const [gridRows, setGridRows] = useState<string | null>(null);

  const { applyLiveStyle } = useLiveStyle();

  // Парсер значений из SCSS
  const extractProp = useCallback(
    (prop: string, scss: string): string | null => {
      const match = scss.match(
        new RegExp(`(?:^|\\s|;)${prop}\\s*:\\s*([^;]+)`, "i"),
      );
      return match ? match[1].trim() : null;
    },
    [],
  );

  useEffect(() => {
    const d = extractProp("display", currentScssText) as DisplayMode | null;
    setActiveDisplay(d);
    setJustifyVal(extractProp("justify-content", currentScssText));
    setAlignVal(extractProp("align-items", currentScssText));
    setFlexDir(extractProp("flex-direction", currentScssText));
    setGridCols(extractProp("grid-template-columns", currentScssText));
    setGridRows(extractProp("grid-template-rows", currentScssText));
  }, [currentClass, currentScssText, extractProp]);

  // Универсальный обработчик применения
  const handleApply = (prop: string, value: string) => {
    applyLiveStyle(currentClass, prop, value as any);
    onApplySnippet(`${prop}: ${value};`);
  };

  const handleSelectDisplay = (mode: DisplayMode) => {
    setActiveDisplay(mode);
    handleApply("display", mode);
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-1.5 shadow-inner select-none">
      {/* 🔹 РЯД 1: ВЫБОР DISPLAY */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
          Display:
        </span>
        {activeDisplay && (
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1 rounded border border-cyan-800/50">
            {activeDisplay}
          </span>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1">
        {DISPLAY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelectDisplay(opt.id)}
            className={`py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer text-center ${
              activeDisplay === opt.id
                ? "bg-cyan-600 border-cyan-400 text-white shadow-sm"
                : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 🔹 КОНТЕКСТ ДЛЯ FLEX */}
      {activeDisplay === "flex" && (
        <div className="pt-1.5 border-t border-zinc-900 flex flex-col gap-1 animate-in fade-in duration-150">
          {/* Direction */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-500">
              Direction:
            </span>
            <div className="flex gap-1">
              {(
                [
                  { id: "row", label: "row" },
                  { id: "column", label: "col" },
                  { id: "row-reverse", label: "row-rev" },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleApply("flex-direction", d.id)}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono border transition cursor-pointer ${
                    flexDir === d.id
                      ? "bg-indigo-600 border-indigo-400 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Justify-content */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-500">
              Justify:
            </span>
            <div className="flex gap-1">
              {(
                [
                  { id: "flex-start", label: "start" },
                  { id: "center", label: "center" },
                  { id: "flex-end", label: "end" },
                  { id: "space-between", label: "between" },
                  { id: "space-around", label: "around" },
                ] as const
              ).map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => handleApply("justify-content", j.id)}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono border transition cursor-pointer ${
                    justifyVal === j.id
                      ? "bg-indigo-600 border-indigo-400 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
                  }`}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>

          {/* Align-items */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-500">
              Align:
            </span>
            <div className="flex gap-1">
              {(
                [
                  { id: "flex-start", label: "start" },
                  { id: "center", label: "center" },
                  { id: "flex-end", label: "end" },
                  { id: "stretch", label: "stretch" },
                ] as const
              ).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleApply("align-items", a.id)}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono border transition cursor-pointer ${
                    alignVal === a.id
                      ? "bg-indigo-600 border-indigo-400 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🔹 КОНТЕКСТ ДЛЯ GRID */}
      {activeDisplay === "grid" && (
        <div className="pt-1.5 border-t border-zinc-900 flex flex-col gap-1 animate-in fade-in duration-150">
          {/* Grid Columns */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-500">
              Cols:
            </span>
            <div className="flex gap-1">
              {(
                [
                  { id: "repeat(2, 1fr)", label: "2 cols" },
                  { id: "repeat(3, 1fr)", label: "3 cols" },
                  { id: "repeat(4, 1fr)", label: "4 cols" },
                  { id: "auto 1fr", label: "auto 1fr" },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleApply("grid-template-columns", c.id)}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono border transition cursor-pointer ${
                    gridCols === c.id
                      ? "bg-cyan-600 border-cyan-400 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Rows */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-500">
              Rows:
            </span>
            <div className="flex gap-1">
              {(
                [
                  { id: "auto", label: "auto" },
                  { id: "repeat(2, 1fr)", label: "2 rows" },
                  { id: "repeat(3, 1fr)", label: "3 rows" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleApply("grid-template-rows", r.id)}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono border transition cursor-pointer ${
                    gridRows === r.id
                      ? "bg-cyan-600 border-cyan-400 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
