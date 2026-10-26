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
  const { extractNumericProp, applyLiveStyle, removeLiveStyle } =
    useLiveStyle();

  useEffect(() => {
    const existing = extractNumericProp(prop, currentScssText);
    setVal(existing || LIMITS[prop].defaultVal);
  }, [prop, currentScssText, extractNumericProp]);

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
          Typography:
        </span>
        <span className="text-[11px] font-mono text-purple-400 font-bold bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-700">
          {val}px
        </span>
      </div>

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
    </div>
  );
}
