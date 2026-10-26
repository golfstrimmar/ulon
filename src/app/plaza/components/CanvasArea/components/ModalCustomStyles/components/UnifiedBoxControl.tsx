import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

type MasterProp =
  | "padding"
  | "margin"
  | "border-radius"
  | "gap"
  | "width"
  | "height"
  | "opacity";

type SpacingSide = "all" | "top" | "right" | "bottom" | "left";
type GapMode = "gap" | "row-gap" | "column-gap";

interface Props {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

export function UnifiedBoxControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  // 🔹 Активное главное свойство
  const [activeProp, setActiveProp] = useState<MasterProp>("padding");

  // Под-состояния
  const [side, setSide] = useState<SpacingSide>("all");
  const [gapMode, setGapMode] = useState<GapMode>("gap");
  const [specialVal, setSpecialVal] = useState<string | null>(null);

  // Значения
  const [val, setVal] = useState<number>(0);
  const [opacityVal, setOpacityVal] = useState<number>(1);

  // 👈 БЛОКИРОВКА ПЕРЕЗАПИСИ ПРИ ПЕРЕТАСКИВАНИИ
  const isDraggingRef = useRef(false);

  const { applyLiveStyle, removeLiveStyle, extractNumericProp } =
    useLiveStyle();

  // Вычисляем реальное имя CSS-свойства
  const getCssPropName = useCallback(() => {
    if (activeProp === "padding" || activeProp === "margin") {
      return side === "all" ? activeProp : `${activeProp}-${side}`;
    }
    if (activeProp === "border-radius") return "border-radius";
    if (activeProp === "gap") return gapMode;
    return activeProp; // width, height, opacity
  }, [activeProp, side, gapMode]);

  // 🔹 Синхронизация с SCSS (только когда НЕ тащим ползунок!)
  useEffect(() => {
    if (isDraggingRef.current) return; // 🛑 БАЗА НЕ ИМЕЕТ ПРАВА ПЕРЕБИВАТЬ ПОЛЗУНОК ПОД ПАЛЬЦЕМ!

    const propName = getCssPropName();

    if (activeProp === "opacity") {
      const match = currentScssText.match(/(?:^|\s|;)opacity\s*:\s*([0-9.]+)/i);
      setOpacityVal(match ? parseFloat(match[1]) : 1);
    } else if (activeProp === "width" || activeProp === "height") {
      const matchSpecial = currentScssText.match(
        new RegExp(
          `(?:^|\\s|;)${activeProp}\\s*:\\s*(100%|auto|fit-content|100vh)`,
          "i",
        ),
      );
      if (matchSpecial) {
        setSpecialVal(matchSpecial[1]);
        setVal(matchSpecial[1] === "100%" ? 100 : 0);
      } else {
        setSpecialVal(null);
        setVal(extractNumericProp(activeProp, currentScssText));
      }
    } else {
      setSpecialVal(null);
      setVal(extractNumericProp(propName, currentScssText));
    }
  }, [
    activeProp,
    side,
    gapMode,
    currentClass,
    currentScssText,
    getCssPropName,
    extractNumericProp,
  ]);

  // Переключение свойства
  const handleSelectProp = (prop: MasterProp) => {
    removeLiveStyle();
    setActiveProp(prop);
    if (prop === "border-radius") setSide("all");
  };

  /* ==========================================================================
     0 MS LIVE INPUT (Только инжект в DOM iframe на каждый пиксель движения)
     ========================================================================== */
  const handleSliderInput = (n: number) => {
    isDraggingRef.current = true;
    setSpecialVal(null);
    const propName = getCssPropName();

    if (activeProp === "opacity") {
      setOpacityVal(n);
      applyLiveStyle(currentClass, "opacity", String(n) as any);
    } else {
      setVal(n);
      applyLiveStyle(currentClass, propName, `${n}px` as any);
    }
  };

  /* ==========================================================================
     SINGLE COMMIT (Единая запись в базу/историю только при отпускании)
     ========================================================================== */
  const handleSliderCommit = () => {
    isDraggingRef.current = false;
    const propName = getCssPropName();

    if (activeProp === "opacity") {
      onApplySnippet(`opacity: ${opacityVal};`);
    } else if (specialVal) {
      onApplySnippet(`${propName}: ${specialVal};`);
    } else {
      onApplySnippet(`${propName}: ${val}px;`);
    }
  };

  // Быстрые пресеты (кликнули — сразу в базу)
  const handleApplyPreset = (valueStr: string) => {
    const propName = getCssPropName();
    if (activeProp === "opacity") {
      const n = Number(valueStr);
      setOpacityVal(n);
      applyLiveStyle(currentClass, "opacity", String(n) as any);
      onApplySnippet(`opacity: ${n};`);
    } else {
      setSpecialVal(valueStr);
      applyLiveStyle(currentClass, propName, valueStr as any);
      onApplySnippet(`${propName}: ${valueStr};`);
    }
  };

  const sliderConfig = {
    min: 0,
    max:
      activeProp === "opacity"
        ? 1
        : activeProp === "width" || activeProp === "height"
          ? 1200
          : activeProp === "gap"
            ? 120
            : 160,
    step:
      activeProp === "opacity"
        ? 0.05
        : activeProp === "width" || activeProp === "height"
          ? 5
          : 1,
    accent:
      activeProp === "opacity"
        ? "accent-amber-500"
        : activeProp === "padding"
          ? "accent-emerald-500"
          : activeProp === "margin"
            ? "accent-orange-500"
            : activeProp === "border-radius"
              ? "accent-sky-500"
              : activeProp === "gap"
                ? "accent-indigo-500"
                : "accent-teal-500",
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner select-none">
      {/* 🔹 РЯД 1: ВЫБОР СВОЙСТВА */}
      <div className="grid grid-cols-7 gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800 text-center">
        {(
          [
            { id: "padding", label: "Pad" },
            { id: "margin", label: "Mar" },
            { id: "border-radius", label: "Rad" },
            { id: "gap", label: "Gap" },
            { id: "width", label: "W" },
            { id: "height", label: "H" },
            { id: "opacity", label: "Op" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleSelectProp(t.id)}
            className={`py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
              activeProp === t.id
                ? "bg-indigo-600 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 🔹 РЯД 2: КОНТЕКСТНЫЕ КНОПКИ */}
      <div className="flex items-center justify-between min-h-[22px]">
        {/* Стороны для Padding / Margin / Radius */}
        {(activeProp === "padding" ||
          activeProp === "margin" ||
          activeProp === "border-radius") && (
          <div className="grid grid-cols-5 gap-1 w-full max-w-[210px]">
            {(
              [
                { id: "all", label: "All" },
                { id: "top", label: "Top" },
                { id: "right", label: "Right" },
                { id: "bottom", label: "Btm" },
                { id: "left", label: "Left" },
              ] as const
            ).map((s) => {
              const isDisabled =
                activeProp === "border-radius" && s.id !== "all";
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    removeLiveStyle();
                    setSide(s.id);
                  }}
                  className={`px-1 py-0.2 rounded text-[9.5px] font-mono font-bold border transition text-center ${
                    isDisabled
                      ? "opacity-20 border-zinc-850 bg-zinc-900/50 text-zinc-600 cursor-not-allowed"
                      : side === s.id
                        ? "bg-indigo-600 border-indigo-400 text-white shadow-sm cursor-pointer"
                        : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Режимы Gap */}
        {activeProp === "gap" && (
          <div className="flex items-center gap-1">
            {(
              [
                { id: "gap", label: "Both" },
                { id: "row-gap", label: "Rows" },
                { id: "column-gap", label: "Cols" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  removeLiveStyle();
                  setGapMode(m.id);
                }}
                className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold border transition cursor-pointer ${
                  gapMode === m.id
                    ? "bg-indigo-600 border-indigo-400 text-white shadow-sm"
                    : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* 100%, auto для Width / Height */}
        {(activeProp === "width" || activeProp === "height") && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleApplyPreset("100%")}
              className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono border transition cursor-pointer ${
                specialVal === "100%"
                  ? "bg-teal-500 border-teal-400 text-white shadow"
                  : "bg-zinc-900 border-zinc-750 text-teal-400 hover:bg-zinc-800"
              }`}
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("auto")}
              className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono border transition cursor-pointer ${
                specialVal === "auto"
                  ? "bg-zinc-700 text-white border-zinc-500"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              auto
            </button>
            {activeProp === "height" && (
              <button
                type="button"
                onClick={() => handleApplyPreset("100vh")}
                className="px-1.5 py-0.2 rounded text-[9.5px] font-mono border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 cursor-pointer"
              >
                100vh
              </button>
            )}
          </div>
        )}

        {/* 0, 0.5, 1 для Opacity */}
        {activeProp === "opacity" && (
          <div className="flex items-center gap-1">
            {(["0", "0.5", "1"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono border transition cursor-pointer ${
                  opacityVal === Number(p)
                    ? "bg-amber-600 border-amber-400 text-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Индикатор текущего значения */}
        <span className="text-[11px] font-mono font-bold bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800 text-indigo-300 ml-auto">
          {activeProp === "opacity"
            ? opacityVal
            : specialVal
              ? specialVal
              : `${val}px`}
        </span>
      </div>

      {/* 🔹 РЯД 3: ПОЛЗУНОК С ЖЕСТКИМ LIVE-ОТКЛИКОМ И ОДНИМ КОММИТОМ */}
      <input
        type="range"
        min={sliderConfig.min}
        max={sliderConfig.max}
        step={sliderConfig.step}
        value={
          activeProp === "opacity"
            ? opacityVal
            : specialVal
              ? specialVal === "100%"
                ? 100
                : 0
              : val
        }
        onPointerDown={() => {
          isDraggingRef.current = true;
        }}
        onInput={(e) =>
          handleSliderInput(Number((e.target as HTMLInputElement).value))
        }
        onChange={(e) =>
          handleSliderInput(Number((e.target as HTMLInputElement).value))
        }
        onPointerUp={handleSliderCommit}
        onPointerCancel={handleSliderCommit}
        className={`w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer ${sliderConfig.accent}`}
      />
    </div>
  );
}
