import React, { useState, useEffect, useCallback } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

type PositionType = "relative" | "absolute" | "fixed" | "sticky" | "static";
type PositionSide = "top" | "left" | "right" | "bottom";

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
  const [activeSide, setActiveSide] = useState<PositionSide>("top");
  const [sideVal, setSideVal] = useState<number>(0);
  const [isPercent, setIsPercent] = useState<boolean>(false);

  const { applyLiveStyle, extractNumericProp } = useLiveStyle();

  // Парсим position и смещения
  useEffect(() => {
    const posMatch = currentScssText.match(
      /(?:^|\s|;)position\s*:\s*([a-zA-Z]+)/i,
    );
    setPosType(posMatch ? (posMatch[1].toLowerCase() as PositionType) : null);

    // Проверяем 50%
    const percentMatch = new RegExp(
      `(?:^|\\s|;)${activeSide}\\s*:\\s*50%`,
      "i",
    ).test(currentScssText);
    if (percentMatch) {
      setIsPercent(true);
      setSideVal(50);
    } else {
      setIsPercent(false);
      setSideVal(extractNumericProp(activeSide, currentScssText));
    }
  }, [currentClass, currentScssText, activeSide, extractNumericProp]);

  const handleSelectPosType = (type: PositionType) => {
    setPosType(type);
    applyLiveStyle(currentClass, "position", type as any);
    onApplySnippet(`position: ${type};`);
  };

  const handleSliderInput = (val: number) => {
    setIsPercent(false);
    setSideVal(val);
    applyLiveStyle(currentClass, activeSide, `${val}px` as any);
  };

  const handleSliderCommit = () => {
    onApplySnippet(`${activeSide}: ${sideVal}px;`);
  };

  // 🎯 Быстрые пресеты: 50%, 0, auto
  const handleApplyPreset = (valueStr: string) => {
    if (valueStr === "50%") {
      setIsPercent(true);
      setSideVal(50);
    } else {
      setIsPercent(false);
      setSideVal(valueStr === "0px" ? 0 : 0);
    }
    applyLiveStyle(currentClass, activeSide, valueStr as any);
    onApplySnippet(`${activeSide}: ${valueStr};`);
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
      {/* Выбор типа Position */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
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

      {/* Выбор стороны (Top, Left, Right, Bottom) */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-900">
        <div className="grid grid-cols-4 gap-1 w-full max-w-[200px]">
          {(["top", "left", "bottom", "right"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSide(s)}
              className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer text-center ${
                activeSide === s
                  ? "bg-blue-600 border-blue-400 text-white shadow-sm"
                  : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Быстрые кнопки 50%, 0, auto */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleApplyPreset("50%")}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
              isPercent && sideVal === 50
                ? "bg-emerald-600 border-emerald-400 text-white shadow"
                : "bg-zinc-900 border-zinc-700 text-emerald-400 hover:bg-zinc-800"
            }`}
            title="Выставить ровно 50% для центрирования"
          >
            50%
          </button>
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

      {/* Индикатор значения и ползунок */}
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span>{activeSide}:</span>
        <span className="text-blue-400 font-bold bg-zinc-900 px-1 rounded border border-zinc-800">
          {isPercent ? "50%" : `${sideVal}px`}
        </span>
      </div>

      <input
        type="range"
        min={-100}
        max={300}
        step={1}
        value={isPercent ? 50 : sideVal}
        onInput={(e) =>
          handleSliderInput(Number((e.target as HTMLInputElement).value))
        }
        onPointerUp={handleSliderCommit}
        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}
