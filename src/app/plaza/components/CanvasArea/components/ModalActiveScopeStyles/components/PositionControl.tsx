import React, { useState, useEffect } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

type PositionType = "relative" | "absolute" | "fixed" | "sticky" | "static";
type PositionProp = "top" | "left" | "bottom" | "right" | "z-index";

interface Props {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

export function PositionControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  const [posType, setPosType] = useState<PositionType | null>(null);
  const [activeProp, setActiveProp] = useState<PositionProp>("top");
  const [val, setVal] = useState<number>(0);
  const [isPercent, setIsPercent] = useState<boolean>(false);

  const { applyLiveStyle, extractNumericProp } = useLiveStyle();

  // Парсим position, смещения и z-index
  useEffect(() => {
    const posMatch = currentScssText.match(
      /(?:^|\s|;)position\s*:\s*([a-zA-Z]+)/i,
    );
    setPosType(posMatch ? (posMatch[1].toLowerCase() as PositionType) : null);

    if (activeProp === "z-index") {
      setIsPercent(false);
      const zMatch = currentScssText.match(/(?:^|\s|;)z-index\s*:\s*(-?\d+)/i);
      setVal(zMatch ? parseInt(zMatch[1], 10) : 0);
    } else {
      // Проверяем 50% для сторон
      const percentMatch = new RegExp(
        `(?:^|\\s|;)${activeProp}\\s*:\\s*50%`,
        "i",
      ).test(currentScssText);

      if (percentMatch) {
        setIsPercent(true);
        setVal(50);
      } else {
        setIsPercent(false);
        setVal(extractNumericProp(activeProp, currentScssText));
      }
    }
  }, [currentClass, currentScssText, activeProp, extractNumericProp]);

  const handleSelectPosType = (type: PositionType) => {
    setPosType(type);
    applyLiveStyle(currentClass, "position", type as any);
    onApplySnippet(`position: ${type};`);
  };

  const handleSliderInput = (newVal: number) => {
    setIsPercent(false);
    setVal(newVal);

    if (activeProp === "z-index") {
      applyLiveStyle(currentClass, "z-index", String(newVal) as any);
    } else {
      applyLiveStyle(currentClass, activeProp, `${newVal}px` as any);
    }
  };

  const handleSliderCommit = () => {
    if (activeProp === "z-index") {
      onApplySnippet(`z-index: ${val};`);
    } else {
      onApplySnippet(`${activeProp}: ${isPercent ? "50%" : `${val}px`};`);
    }
  };

  // 🎯 Быстрые пресеты
  const handleApplyPreset = (preset: string) => {
    if (activeProp === "z-index") {
      const num = parseInt(preset, 10);
      setVal(isNaN(num) ? 0 : num);
      applyLiveStyle(currentClass, "z-index", preset as any);
      onApplySnippet(`z-index: ${preset};`);
      return;
    }

    if (preset === "50%") {
      setIsPercent(true);
      setVal(50);
    } else {
      setIsPercent(false);
      setVal(0);
    }
    applyLiveStyle(currentClass, activeProp, preset as any);
    onApplySnippet(`${activeProp}: ${preset};`);
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
      {/* Выбор типа Position */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-mono text-indigo-300 font-semibold tracking-wider">
          Position:
        </span>
        <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
          {(["relative", "absolute", "fixed", "sticky"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleSelectPosType(t)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                posType === t
                  ? "bg-blue-600 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Выбор свойства: Top, Left, Bottom, Right, Z-Index */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-900 gap-1">
        <div className="flex items-center gap-1 flex-1">
          {(["top", "left", "bottom", "right", "z-index"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActiveProp(p)}
              className={`flex-1 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer text-center ${
                activeProp === p
                  ? "bg-blue-600 border-blue-400 text-white shadow-sm"
                  : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {p === "z-index" ? "z-idx" : p}
            </button>
          ))}
        </div>

        {/* Быстрые кнопки пресетов */}
        <div className="flex items-center gap-1">
          {activeProp !== "z-index" ? (
            <button
              type="button"
              onClick={() => handleApplyPreset("50%")}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
                isPercent && val === 50
                  ? "bg-emerald-600 border-emerald-400 text-white shadow"
                  : "bg-zinc-900 border-zinc-700 text-emerald-400 hover:bg-zinc-800"
              }`}
              title="Выставить ровно 50%"
            >
              50%
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleApplyPreset("-1")}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              -1
            </button>
          )}

          <button
            type="button"
            onClick={() => handleApplyPreset("0px")}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("auto")}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            auto
          </button>
        </div>
      </div>

      {/* Индикатор значения */}
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span>{activeProp}:</span>
        <span className="text-blue-400 font-bold bg-zinc-900 px-1 rounded border border-zinc-800">
          {activeProp === "z-index" ? val : isPercent ? "50%" : `${val}px`}
        </span>
      </div>

      {/* Единый ползунок с шагом 1 */}
      <input
        type="range"
        min={activeProp === "z-index" ? -50 : -100}
        max={activeProp === "z-index" ? 100 : 300}
        step={1}
        value={isPercent ? 50 : val}
        onInput={(e) =>
          handleSliderInput(Number((e.target as HTMLInputElement).value))
        }
        onPointerUp={handleSliderCommit}
        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}
