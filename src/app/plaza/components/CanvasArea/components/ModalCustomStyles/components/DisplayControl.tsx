import React, { useState, useEffect, useCallback } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";
import { motion, AnimatePresence } from "framer-motion";
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
  { id: "inline-block", label: "inline-block" },
  { id: "none", label: "none" },
];

const FLEX_DIRECTION_OPTIONS = [
  { id: "row", label: "row" },
  { id: "column", label: "col" },
  { id: "row-reverse", label: "row-rev" },
] as const;

const FLEX_JUSTIFY_OPTIONS = [
  { id: "flex-start", label: "start" },
  { id: "center", label: "center" },
  { id: "flex-end", label: "end" },
  { id: "space-between", label: "between" },
  { id: "space-around", label: "around" },
] as const;

const FLEX_ALIGN_OPTIONS = [
  { id: "flex-start", label: "start" },
  { id: "center", label: "center" },
  { id: "flex-end", label: "end" },
  { id: "stretch", label: "stretch" },
] as const;

const GRID_JUSTIFY_OPTIONS = [
  { id: "start", label: "start" },
  { id: "center", label: "center" },
  { id: "end", label: "end" },
  { id: "space-between", label: "between" },
  { id: "space-around", label: "around" },
] as const;

const GRID_ALIGN_OPTIONS = [
  { id: "start", label: "start" },
  { id: "center", label: "center" },
  { id: "end", label: "end" },
  { id: "stretch", label: "stretch" },
] as const;

const GRID_COLS_OPTIONS = [
  { id: "repeat(2, 1fr)", label: "2 cols" },
  { id: "repeat(3, 1fr)", label: "3 cols" },
  { id: "repeat(4, 1fr)", label: "4 cols" },
  { id: "auto 1fr", label: "auto 1fr" },
] as const;

const GRID_ROWS_OPTIONS = [
  { id: "auto", label: "auto" },
  { id: "repeat(2, 1fr)", label: "2 rows" },
  { id: "repeat(3, 1fr)", label: "3 rows" },
] as const;

interface OptionRowProps {
  label: string;
  prop: string;
  value: string | null;
  options: readonly { id: string; label: string }[];
  activeColor?: string;
  onApply: (prop: string, value: string) => void;
  onReset: (prop: string) => void;
}

function OptionRow({
  label,
  prop,
  value,
  options,
  activeColor = "bg-indigo-600 border-indigo-400",
  onApply,
  onReset,
}: OptionRowProps) {
  return (
    <div className="flex items-center justify-between gap-1 h-5">
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[9px] font-mono uppercase text-zinc-500 w-12 truncate">
          {label}:
        </span>

        <button
          type="button"
          onClick={() => onReset(prop)}
          title={`Reset ${label}`}
          className={`w-3.5 h-3.5 flex items-center justify-center rounded text-[8px] font-mono border transition-colors cursor-pointer ${
            value
              ? "border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              : "border-zinc-800 text-zinc-700 cursor-not-allowed"
          }`}
        >
          ×
        </button>
      </div>

      <div className="flex gap-1 shrink-0">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onApply(prop, option.id)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors cursor-pointer ${
              value === option.id
                ? `${activeColor} text-white`
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DisplayControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  const [activeDisplay, setActiveDisplay] = useState<DisplayMode | null>(null);

  const [justifyVal, setJustifyVal] = useState<string | null>(null);
  const [alignVal, setAlignVal] = useState<string | null>(null);
  const [flexDir, setFlexDir] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<string | null>(null);
  const [gridRows, setGridRows] = useState<string | null>(null);

  const { applyLiveStyle, removeLiveStyle } = useLiveStyle();

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

  const handleApply = (prop: string, value: string) => {
    applyLiveStyle(currentClass, prop, value as any);
    onApplySnippet(`${prop}: ${value};`);
  };

  const handleReset = (prop: string) => {
    removeLiveStyle();
    onApplySnippet(`${prop}: initial;`);
  };

  const handleSelectDisplay = (mode: DisplayMode) => {
    setActiveDisplay(mode);
    handleApply("display", mode);
  };

  const isFlex = activeDisplay === "flex";
  const isGrid = activeDisplay === "grid";
  const hasOptions = isFlex || isGrid;

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-1.5 shadow-inner select-none">
      {/* DISPLAY HEADER */}
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

      {/* DISPLAY BUTTONS */}
      <div className="flex items-center gap-1">
        {DISPLAY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelectDisplay(opt.id)}
            className={`py-0.5 px-2 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer text-center ${
              activeDisplay === opt.id
                ? "bg-cyan-600 border-cyan-400 text-white shadow-sm"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ПЛАВНЫЙ АККОРДЕОН БЕЗ РЫВКОВ */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
          hasOptions
            ? "grid-rows-[1fr] opacity-100 mt-0.5"
            : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-1.5 border-t border-zinc-900/80">
            {isFlex && (
              <div className="flex flex-col gap-1 animate-in fade-in duration-150">
                <OptionRow
                  label="Direction"
                  prop="flex-direction"
                  value={flexDir}
                  options={FLEX_DIRECTION_OPTIONS}
                  onApply={handleApply}
                  onReset={handleReset}
                />

                <OptionRow
                  label="Justify"
                  prop="justify-content"
                  value={justifyVal}
                  options={FLEX_JUSTIFY_OPTIONS}
                  onApply={handleApply}
                  onReset={handleReset}
                />

                <OptionRow
                  label="Align"
                  prop="align-items"
                  value={alignVal}
                  options={FLEX_ALIGN_OPTIONS}
                  onApply={handleApply}
                  onReset={handleReset}
                />
              </div>
            )}

            {isGrid && (
              <div className="flex flex-col gap-1 animate-in fade-in duration-150">
                <OptionRow
                  label="Justify"
                  prop="justify-content"
                  value={justifyVal}
                  options={GRID_JUSTIFY_OPTIONS}
                  onApply={handleApply}
                  onReset={handleReset}
                />

                <OptionRow
                  label="Align"
                  prop="align-items"
                  value={alignVal}
                  options={GRID_ALIGN_OPTIONS}
                  onApply={handleApply}
                  onReset={handleReset}
                />

                <OptionRow
                  label="Cols"
                  prop="grid-template-columns"
                  value={gridCols}
                  options={GRID_COLS_OPTIONS}
                  activeColor="bg-cyan-600 border-cyan-400"
                  onApply={handleApply}
                  onReset={handleReset}
                />

                <OptionRow
                  label="Rows"
                  prop="grid-template-rows"
                  value={gridRows}
                  options={GRID_ROWS_OPTIONS}
                  activeColor="bg-cyan-600 border-cyan-400"
                  onApply={handleApply}
                  onReset={handleReset}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
