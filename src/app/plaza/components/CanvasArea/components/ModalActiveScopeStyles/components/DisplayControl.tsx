import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

type DisplayMode =
  | "flex"
  | "inline-flex"
  | "grid"
  | "block"
  | "inline-block"
  | "inline"
  | "none";
type PaneId = "flex" | "grid";

interface Props {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

/* ─── константы ──────────────────────────────────────────── */

const DISPLAY_OPTIONS: { id: DisplayMode; label: string }[] = [
  { id: "flex", label: "flex" },
  { id: "inline-flex", label: "inline-flex" },
  { id: "grid", label: "grid" },
  { id: "block", label: "block" },
  { id: "inline-block", label: "inline-block" },
  { id: "none", label: "none" },
];

const FLEX_DIR = [
  { id: "row", label: "row" },
  { id: "column", label: "col" },
  { id: "row-reverse", label: "row-rev" },
] as const;
const FLEX_WRAP = [
  { id: "wrap", label: "wrap" },
  { id: "nowrap", label: "nowrap" },
] as const;
const FLEX_JUSTIFY = [
  { id: "flex-start", label: "start" },
  { id: "center", label: "center" },
  { id: "flex-end", label: "end" },
  { id: "space-between", label: "between" },
  { id: "space-around", label: "around" },
] as const;
const FLEX_ALIGN = [
  { id: "flex-start", label: "start" },
  { id: "center", label: "center" },
  { id: "flex-end", label: "end" },
  { id: "stretch", label: "stretch" },
] as const;

const GRID_JUSTIFY = [
  { id: "start", label: "start" },
  { id: "center", label: "center" },
  { id: "end", label: "end" },
  { id: "space-between", label: "between" },
  { id: "space-around", label: "around" },
] as const;
const GRID_ALIGN = [
  { id: "start", label: "start" },
  { id: "center", label: "center" },
  { id: "end", label: "end" },
  { id: "stretch", label: "stretch" },
] as const;

const GRID_COLS = [
  { id: "1fr", label: "1fr" },
  { id: "repeat(2, 1fr)", label: "2 col" },
  { id: "repeat(3, 1fr)", label: "3 col" },
  { id: "repeat(4, 1fr)", label: "4 col" },
  { id: "auto 1fr", label: "auto 1fr" },
] as const;
const GRID_ROWS = [
  { id: "auto", label: "auto" },
  { id: "repeat(2, 1fr)", label: "2 row" },
  { id: "repeat(3, 1fr)", label: "3 row" },
] as const;

/* ─── вспомогательный ряд кнопок ─────────────────────────── */

function OptionRow({
  label,
  prop,
  value,
  options,
  onApply,
  onReset,
}: {
  label: string;
  prop: string;
  value: string | null;
  options: readonly { id: string; label: string }[];
  onApply: (p: string, v: string) => void;
  onReset: (p: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[9px] font-mono text-zinc-400 w-14 truncate">
          {label}:
        </span>
        <button
          type="button"
          onClick={() => onReset(prop)}
          className={`w-3.5 h-3.5 flex items-center justify-center rounded text-[9px] border transition cursor-pointer ${
            value
              ? "border-zinc-700 text-zinc-400 hover:text-red-400"
              : "border-zinc-800 text-zinc-700 opacity-40 cursor-not-allowed"
          }`}
        >
          ✕
        </button>
      </div>
      <div className="flex gap-1 flex-wrap justify-end">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onApply(prop, opt.id)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition cursor-pointer ${
              value === opt.id
                ? "bg-cyan-600 border-cyan-400 text-white font-bold"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── основной компонент ──────────────────────────────────── */

export function DisplayControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  // Что подсвечено (читается из SCSS) — только для подсветки кнопок
  const [activeDisplay, setActiveDisplay] = useState<DisplayMode | null>(null);

  // Какая панель открыта — независимый тогл, как в JS-табах
  const [openPane, setOpenPane] = useState<PaneId | null>(null);

  // Flex sub-props
  const [flexDir, setFlexDir] = useState<string | null>(null);
  const [flexWrap, setFlexWrap] = useState<string | null>(null); // 👈 Добавлено
  const [justifyVal, setJustifyVal] = useState<string | null>(null);
  const [alignVal, setAlignVal] = useState<string | null>(null);

  // Grid sub-props
  const [gridCols, setGridCols] = useState<string | null>(null);
  const [gridRows, setGridRows] = useState<string | null>(null);

  // 🔹 Flex basis / ratio percentage (например, flex: 0 0 16.7%)
  const [flexPercent, setFlexPercent] = useState<number | null>(null);
  const isDraggingFlexRef = useRef<boolean>(false);

  const { applyLiveStyle, removeLiveStyle } = useLiveStyle();

  const extractProp = useCallback(
    (prop: string, scss: string): string | null => {
      const m = scss.match(
        new RegExp(`(?:^|\\s|;)${prop}\\s*:\\s*([^;]+)`, "i"),
      );
      return m ? m[1].trim() : null;
    },
    [],
  );

  // Синхронизируем подсветку кнопок и sub-props из SCSS
  useEffect(() => {
    setActiveDisplay(
      extractProp("display", currentScssText) as DisplayMode | null,
    );
    setFlexDir(extractProp("flex-direction", currentScssText));
    setFlexWrap(extractProp("flex-wrap", currentScssText)); // 👈 Добавлено
    setJustifyVal(extractProp("justify-content", currentScssText));
    setAlignVal(extractProp("align-items", currentScssText));
    setGridCols(extractProp("grid-template-columns", currentScssText));
    setGridRows(extractProp("grid-template-rows", currentScssText));

    if (!isDraggingFlexRef.current) {
      const flexMatch = currentScssText.match(
        /(?:^|\s|;)flex\s*:\s*(?:(?:0\s+0\s+)|(?:1\s+1\s+))?([0-9]+(?:\.[0-9]+)?)\s*%/i,
      );
      if (flexMatch) {
        setFlexPercent(parseFloat(flexMatch[1]));
        setOpenPane((prev) => prev ?? "flex");
      } else {
        setFlexPercent(null);
      }
    }
  }, [currentClass, currentScssText, extractProp]);

  // 🔹 По живому регулируем flex: 0 0 X.X%
  const handleFlexPercentChange = (val: number) => {
    isDraggingFlexRef.current = true;
    const clamped = Math.max(0.1, Math.min(100, Math.round(val * 10) / 10));
    setFlexPercent(clamped);
    const ruleVal = `0 0 ${clamped.toFixed(1)}%`;
    applyLiveStyle(currentClass, "flex", ruleVal as any);
  };

  const handleFlexPercentCommit = () => {
    isDraggingFlexRef.current = false;
    if (flexPercent === null) return;
    const ruleVal = `0 0 ${flexPercent.toFixed(1)}%`;
    applyLiveStyle(currentClass, "flex", ruleVal as any);
    onApplySnippet(`flex: ${ruleVal};`);
  };

  const handleFlexPresetClick = (val: number) => {
    isDraggingFlexRef.current = false;
    setFlexPercent(val);
    const ruleVal = `0 0 ${val.toFixed(1)}%`;
    applyLiveStyle(currentClass, "flex", ruleVal as any);
    onApplySnippet(`flex: ${ruleVal};`);
  };

  const resetFlexPercent = () => {
    isDraggingFlexRef.current = false;
    setFlexPercent(null);
    removeLiveStyle();
    onApplySnippet("flex: initial;");
  };

  /* ── применение sub-prop ──────────────────────────────── */
  const applyProp = (prop: string, value: string) => {
    if (prop === "justify-content") setJustifyVal(value);
    else if (prop === "align-items") setAlignVal(value);
    else if (prop === "flex-direction") setFlexDir(value);
    else if (prop === "flex-wrap")
      setFlexWrap(value); // 👈 Добавлено
    else if (prop === "grid-template-columns") setGridCols(value);
    else if (prop === "grid-template-rows") setGridRows(value);
    applyLiveStyle(currentClass, prop, value as any);
    onApplySnippet(`${prop}: ${value};`);
  };

  const resetProp = (prop: string) => {
    if (prop === "justify-content") setJustifyVal(null);
    else if (prop === "align-items") setAlignVal(null);
    else if (prop === "flex-direction") setFlexDir(null);
    else if (prop === "flex-wrap")
      setFlexWrap(null); // 👈 Добавлено
    else if (prop === "grid-template-columns") setGridCols(null);
    else if (prop === "grid-template-rows") setGridRows(null);
    removeLiveStyle();
    onApplySnippet(`${prop}: initial;`);
  };

  /* ── клик по кнопке display (как tabs__btn) ───────────── */
  const handleDisplayClick = (mode: DisplayMode) => {
    if (mode === "flex" || mode === "grid") {
      if (openPane === mode) {
        setOpenPane(null);
        setActiveDisplay(null);
        removeLiveStyle();
        onApplySnippet("display: initial;");
      } else {
        setOpenPane(mode);
        setActiveDisplay(mode);
        applyLiveStyle(currentClass, "display", mode as any);
        onApplySnippet(`display: ${mode};`);
      }
    } else {
      setOpenPane(null);
      if (activeDisplay === mode) {
        setActiveDisplay(null);
        removeLiveStyle();
        onApplySnippet("display: initial;");
      } else {
        setActiveDisplay(mode);
        applyLiveStyle(currentClass, "display", mode as any);
        onApplySnippet(`display: ${mode};`);
      }
    }
  };

  /* ── рендер ──────────────────────────────────────────── */
  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner select-none">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-mono text-indigo-300 font-semibold tracking-wider">
          Display:
        </span>
        {activeDisplay && (
          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 rounded border border-cyan-800/60 font-semibold">
            {activeDisplay}
          </span>
        )}
      </div>

      {/* Кнопки-табы */}
      <div className="flex items-center gap-1">
        {DISPLAY_OPTIONS.map((opt) => {
          const hasPane = opt.id === "flex" || opt.id === "grid";
          const isPaneOpen = openPane === opt.id;
          const isActive = activeDisplay === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleDisplayClick(opt.id)}
              className={`py-0.5 px-2 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
                isActive
                  ? isPaneOpen
                    ? "bg-cyan-500 border-cyan-300 text-white"
                    : "bg-cyan-600 border-cyan-400 text-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {opt.label}
              {hasPane && isActive && (
                <span className="ml-1 text-[8px] opacity-70">
                  {isPaneOpen ? "▲" : "▼"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Панель flex — отображается как tabs__pane _is-active */}
      {openPane === "flex" && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-800">
          <OptionRow
            label="Direction"
            prop="flex-direction"
            value={flexDir}
            options={FLEX_DIR}
            onApply={applyProp}
            onReset={resetProp}
          />
          {/* 👈 Блок Wrap */}
          <OptionRow
            label="Wrap"
            prop="flex-wrap"
            value={flexWrap}
            options={FLEX_WRAP}
            onApply={applyProp}
            onReset={resetProp}
          />
          <OptionRow
            label="Justify"
            prop="justify-content"
            value={justifyVal}
            options={FLEX_JUSTIFY}
            onApply={applyProp}
            onReset={resetProp}
          />
          <OptionRow
            label="Align"
            prop="align-items"
            value={alignVal}
            options={FLEX_ALIGN}
            onApply={applyProp}
            onReset={resetProp}
          />
        </div>
      )}

      {/* 🔹 Ползунок flex: 0 0 16.7% (до десятых долей процента) */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] font-mono text-zinc-400 w-14 truncate">
              flex:
            </span>
            <button
              type="button"
              onClick={resetFlexPercent}
              className={`w-3.5 h-3.5 flex items-center justify-center rounded text-[9px] border transition cursor-pointer ${
                flexPercent !== null
                  ? "border-zinc-700 text-zinc-400 hover:text-red-400"
                  : "border-zinc-800 text-zinc-700 opacity-40 cursor-not-allowed"
              }`}
              title="Reset flex"
            >
              ✕
            </button>
          </div>

          <code className="text-cyan-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 font-mono text-[9px] font-semibold">
            {flexPercent !== null
              ? `flex: 0 0 ${flexPercent.toFixed(1)}%;`
              : "flex: none"}
          </code>
        </div>

        {/* Слайдер и числовой инпут */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.1}
            max={100}
            step={0.1}
            value={flexPercent ?? 100}
            onChange={(e) =>
              handleFlexPercentChange(parseFloat(e.target.value))
            }
            onPointerUp={handleFlexPercentCommit}
            onKeyUp={handleFlexPercentCommit}
            className="flex-1 accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
          />
          <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 w-18 shrink-0">
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={flexPercent !== null ? flexPercent : ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) {
                  handleFlexPercentChange(v);
                  handleFlexPercentCommit();
                }
              }}
              placeholder="%"
              className="w-full bg-transparent text-right text-[10px] font-mono text-white focus:outline-none"
            />
            <span className="text-[9px] font-mono text-zinc-500">%</span>
          </div>
        </div>

        {/* Быстрые пресеты до десятых */}
        <div className="flex items-center gap-1 flex-wrap">
          {[16.7, 20, 25, 33.3, 50, 66.7, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleFlexPresetClick(preset)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition cursor-pointer ${
                flexPercent !== null && Math.abs(flexPercent - preset) < 0.1
                  ? "bg-cyan-600 border-cyan-400 text-white font-bold"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {preset}%
            </button>
          ))}
        </div>
      </div>

      {/* Панель grid — отображается как tabs__pane _is-active */}
      {openPane === "grid" && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-800">
          <OptionRow
            label="Justify"
            prop="justify-content"
            value={justifyVal}
            options={GRID_JUSTIFY}
            onApply={applyProp}
            onReset={resetProp}
          />
          <OptionRow
            label="Align"
            prop="align-items"
            value={alignVal}
            options={GRID_ALIGN}
            onApply={applyProp}
            onReset={resetProp}
          />
          <OptionRow
            label="Cols"
            prop="grid-template-columns"
            value={gridCols}
            options={GRID_COLS}
            onApply={applyProp}
            onReset={resetProp}
          />
          <OptionRow
            label="Rows"
            prop="grid-template-rows"
            value={gridRows}
            options={GRID_ROWS}
            onApply={applyProp}
            onReset={resetProp}
          />
        </div>
      )}
    </div>
  );
}
