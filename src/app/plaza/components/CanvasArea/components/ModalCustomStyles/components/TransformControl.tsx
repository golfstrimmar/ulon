import React, { useState, useEffect } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

interface Props {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

export function TransformControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  const [xVal, setXVal] = useState<number>(0);
  const [yVal, setYVal] = useState<number>(0);
  const [activeCenterPreset, setActiveCenterPreset] = useState<string | null>(
    null,
  );

  const { applyLiveStyle } = useLiveStyle();

  useEffect(() => {
    // Проверяем наличие translate(-50%, -50%) в стилях
    if (/translate\(\s*-50%\s*,\s*-50%\s*\)/i.test(currentScssText)) {
      setActiveCenterPreset("both");
    } else if (/translateX\(\s*-50%\s*\)/i.test(currentScssText)) {
      setActiveCenterPreset("x");
    } else if (/translateY\(\s*-50%\s*\)/i.test(currentScssText)) {
      setActiveCenterPreset("y");
    } else {
      setActiveCenterPreset(null);
    }
  }, [currentClass, currentScssText]);

  // 🎯 Применение центровки -50%
  const handleApplyCenterPreset = (type: "both" | "x" | "y" | "none") => {
    setActiveCenterPreset(type === "none" ? null : type);

    let snippet = "";
    if (type === "both") snippet = "translate(-50%, -50%)";
    if (type === "x") snippet = "translateX(-50%)";
    if (type === "y") snippet = "translateY(-50%)";
    if (type === "none") snippet = "none";

    applyLiveStyle(currentClass, "transform", snippet as any);
    onApplySnippet(`transform: ${snippet};`);
  };

  // Ползунки смещения в px
  const handleXChange = (val: number) => {
    setActiveCenterPreset(null);
    setXVal(val);
    const rule = `translate(${val}px, ${yVal}px)`;
    applyLiveStyle(currentClass, "transform", rule as any);
  };

  const handleYChange = (val: number) => {
    setActiveCenterPreset(null);
    setYVal(val);
    const rule = `translate(${xVal}px, ${val}px)`;
    applyLiveStyle(currentClass, "transform", rule as any);
  };

  const handleCommit = () => {
    onApplySnippet(`transform: translate(${xVal}px, ${yVal}px);`);
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
          Transform (Center):
        </span>

        {/* 🎯 Кнопки центрирования (-50%) */}
        <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
          <button
            type="button"
            onClick={() => handleApplyCenterPreset("both")}
            title="transform: translate(-50%, -50%) — Центр по обеим осям"
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
              activeCenterPreset === "both"
                ? "bg-fuchsia-600 text-white shadow"
                : "text-fuchsia-400 hover:bg-zinc-800"
            }`}
          >
            -50% XY
          </button>
          <button
            type="button"
            onClick={() => handleApplyCenterPreset("x")}
            title="transform: translateX(-50%)"
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
              activeCenterPreset === "x"
                ? "bg-fuchsia-600 text-white shadow"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            -50% X
          </button>
          <button
            type="button"
            onClick={() => handleApplyCenterPreset("y")}
            title="transform: translateY(-50%)"
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
              activeCenterPreset === "y"
                ? "bg-fuchsia-600 text-white shadow"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            -50% Y
          </button>
          <button
            type="button"
            onClick={() => handleApplyCenterPreset("none")}
            className="px-1 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Ползунки Translate X и Y в пикселях */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-900">
        <div>
          <div className="flex justify-between text-[9px] font-mono text-zinc-400 mb-0.5">
            <span>translateX:</span>
            <span className="text-fuchsia-400">{xVal}px</span>
          </div>
          <input
            type="range"
            min={-150}
            max={150}
            step={1}
            value={xVal}
            onInput={(e) =>
              handleXChange(Number((e.target as HTMLInputElement).value))
            }
            onPointerUp={handleCommit}
            className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-fuchsia-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-[9px] font-mono text-zinc-400 mb-0.5">
            <span>translateY:</span>
            <span className="text-fuchsia-400">{yVal}px</span>
          </div>
          <input
            type="range"
            min={-150}
            max={150}
            step={1}
            value={yVal}
            onInput={(e) =>
              handleYChange(Number((e.target as HTMLInputElement).value))
            }
            onPointerUp={handleCommit}
            className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-fuchsia-500"
          />
        </div>
      </div>
    </div>
  );
}
