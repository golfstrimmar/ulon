import React, { useState, useEffect } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

type TypoProp = "font-size" | "line-height" | "letter-spacing";

const LIMITS: Record<
  TypoProp,
  { min: number; max: number; step: number; defaultVal: number }
> = {
  "font-size": { min: 8, max: 96, step: 1, defaultVal: 16 },
  "line-height": { min: 8, max: 120, step: 1, defaultVal: 24 },
  "letter-spacing": { min: -2, max: 20, step: 0.5, defaultVal: 0 },
};

// 🔹 Все возможные варианты font-weight по спецификации CSS
const FONT_WEIGHTS = [
  { value: "100", label: "100 — Thin" },
  { value: "200", label: "200 — Extra Light" },
  { value: "300", label: "300 — Light" },
  { value: "400", label: "400 — Regular (Normal)" },
  { value: "500", label: "500 — Medium" },
  { value: "600", label: "600 — Semi Bold" },
  { value: "700", label: "700 — Bold" },
  { value: "800", label: "800 — Extra Bold" },
  { value: "900", label: "900 — Black" },
] as const;

interface Props {
  currentClass: string;
  currentScssText: string;
  onApplySnippet: (snippetCss: string) => void;
}

export function TypographyControl({
  currentClass,
  currentScssText,
  onApplySnippet,
}: Props) {
  const [prop, setProp] = useState<TypoProp>("font-size");
  const [val, setVal] = useState<number>(16);
  const [weight, setWeight] = useState<string>("400");

  const { extractNumericProp, applyLiveStyle, removeLiveStyle } =
    useLiveStyle();

  // Извлекаем числовые свойства (size, line-height, letter-spacing)
  useEffect(() => {
    const existing = extractNumericProp(prop, currentScssText);
    setVal(existing || LIMITS[prop].defaultVal);
  }, [prop, currentScssText, extractNumericProp]);

  // 🔹 Извлекаем текущий font-weight из SCSS
  useEffect(() => {
    const match = currentScssText.match(/font-weight\s*:\s*([^;}\s]+)/i);
    if (match) {
      const raw = match[1].trim().toLowerCase();
      if (raw === "normal") setWeight("400");
      else if (raw === "bold") setWeight("700");
      else if (raw === "bolder") setWeight("800");
      else if (raw === "lighter") setWeight("300");
      else setWeight(raw);
    } else {
      setWeight("400");
    }
  }, [currentScssText]);

  const handleWeightChange = (newWeight: string) => {
    setWeight(newWeight);
    applyLiveStyle(currentClass, "font-weight", Number(newWeight) as any);
    onApplySnippet(`font-weight: ${newWeight};`);
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
      {/* Заголовок + индикатор значения слайдера */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
          Typography:
        </span>
        <span className="text-[11px] font-mono text-purple-400 font-bold bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-700">
          {val}px
        </span>
      </div>

      {/* Вкладки: Size, Line H, Letter */}
      <div className="grid grid-cols-3 gap-1">
        {(["font-size", "line-height", "letter-spacing"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              removeLiveStyle();
              setProp(p);
            }}
            className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer text-center ${
              prop === p
                ? "bg-purple-600 border-purple-400 text-white shadow-sm"
                : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {p === "font-size"
              ? "Size"
              : p === "line-height"
                ? "Line H"
                : "Letter"}
          </button>
        ))}
      </div>

      {/* Слайдер для активного свойства */}
      <input
        type="range"
        min={LIMITS[prop].min}
        max={LIMITS[prop].max}
        step={LIMITS[prop].step}
        value={val}
        onInput={(e) => {
          const n = Number((e.target as HTMLInputElement).value);
          setVal(n);
          applyLiveStyle(currentClass, prop, n);
        }}
        onPointerUp={() => onApplySnippet(`${prop}: ${val}px;`)}
        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
      />

      {/* 🔹 Блок выбора Font Weight (Все возможные варианты) */}
      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-zinc-800/80">
        <span className="text-[10px] font-mono text-zinc-400 font-semibold shrink-0 uppercase tracking-tight">
          Weight:
        </span>

        <select
          value={weight}
          onChange={(e) => handleWeightChange(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-zinc-200 text-[10px] font-mono rounded px-1.5 py-0.5 outline-none focus:border-purple-500 cursor-pointer transition truncate"
        >
          {FONT_WEIGHTS.map((fw) => (
            <option
              key={fw.value}
              value={fw.value}
              className="bg-zinc-900 text-zinc-200 font-mono text-[11px]"
            >
              {fw.label}
            </option>
          ))}
        </select>

        <span
          className="text-[10px] font-mono font-bold text-purple-400 bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded shrink-0 min-w-[28px] text-center"
          title="Current Weight"
        >
          {weight}
        </span>
      </div>
    </div>
  );
}
