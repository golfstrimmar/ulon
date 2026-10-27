import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

type MasterProp =
  | "margin"
  | "padding"
  | "border-radius"
  | "gap"
  | "width"
  | "height"
  | "opacity";

type SpacingSide = "top" | "right" | "bottom" | "left" | "all";
type GapMode = "gap" | "row-gap" | "column-gap";

interface Props {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

const propStyles: Record<MasterProp, string> = {
  margin: "bg-indigo-600 text-white shadow-indigo-500/30",
  padding: "bg-emerald-600 text-white shadow-emerald-500/30",
  gap: "bg-violet-600 text-white shadow-violet-500/30",
  "border-radius": "bg-amber-500 text-zinc-950 shadow-amber-500/30",
  width: "bg-sky-600 text-white shadow-sky-500/30",
  height: "bg-rose-600 text-white shadow-rose-500/30",
  opacity: "bg-zinc-600 text-white shadow-zinc-500/30",
};

const propThumbColors: Record<MasterProp, string> = {
  margin: "#4f46e5",
  padding: "#059669",
  gap: "#7c3aed",
  "border-radius": "#f59e0b",
  width: "#0284c7",
  height: "#e11d48",
  opacity: "#52525b",
};

export function UnifiedBoxControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  const [activeProp, setActiveProp] = useState<MasterProp>("padding");

  const [side, setSide] = useState<SpacingSide>("all");
  const [gapMode, setGapMode] = useState<GapMode>("gap");
  const [specialVal, setSpecialVal] = useState<string | null>(null);

  const [val, setVal] = useState<number>(0);
  const [opacityVal, setOpacityVal] = useState<number>(1);

  const isDraggingRef = useRef(false);

  const { applyLiveStyle, removeLiveStyle, extractNumericProp } =
    useLiveStyle();

  const getCssPropName = useCallback(() => {
    if (activeProp === "padding" || activeProp === "margin") {
      return side === "all" ? activeProp : `${activeProp}-${side}`;
    }

    if (activeProp === "border-radius") return "border-radius";
    if (activeProp === "gap") return gapMode;

    return activeProp;
  }, [activeProp, side, gapMode]);

  useEffect(() => {
    if (isDraggingRef.current) return;

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

  const handleSelectProp = (prop: MasterProp) => {
    removeLiveStyle();
    setActiveProp(prop);

    if (prop === "border-radius") {
      setSide("all");
    }
  };

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
  };

  const thumbColor = propThumbColors[activeProp];

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner select-none">
      <style>{`
        .ubc-range {
          accent-color: ${thumbColor};
        }

        .ubc-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: ${thumbColor};
          border: 2px solid #18181b;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
          cursor: pointer;
          transition: transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .ubc-range::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 3px ${thumbColor}55;
        }

        .ubc-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: ${thumbColor};
          border: 2px solid #18181b;
          cursor: pointer;
        }

        .ubc-range::-moz-range-track {
          background: #27272a;
          border-radius: 9999px;
        }
      `}</style>

      {/* РЯД 1: ВЫБОР СВОЙСТВА */}
      <div className="grid grid-cols-7 gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800 text-center">
        {(
          [
            { id: "margin", label: "Mar" },
            { id: "padding", label: "Pad" },
            { id: "gap", label: "Gap" },
            { id: "border-radius", label: "B-R" },
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
                ? `${propStyles[t.id]} shadow`
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* РЯД 2: КОНТЕКСТНЫЕ КНОПКИ */}
      <div className="flex items-center justify-between min-h-[22px]">
        {(activeProp === "padding" ||
          activeProp === "margin" ||
          activeProp === "border-radius") && (
          <div className="grid grid-cols-5 gap-1 w-full">
            {(
              [
                { id: "top", label: "⇧" },
                { id: "right", label: "⇨" },
                { id: "bottom", label: "⇩" },
                { id: "left", label: "⇦" },
                { id: "all", label: "↔↕↔" },
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
                  className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold border transition text-center ${
                    isDisabled
                      ? "opacity-20 border-zinc-800 bg-zinc-900/50 text-zinc-600 cursor-not-allowed"
                      : side === s.id
                        ? "bg-indigo-600 border-indigo-400 text-white shadow-sm cursor-pointer"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

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
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border transition cursor-pointer ${
                  gapMode === m.id
                    ? "bg-indigo-600 border-indigo-400 text-white shadow-sm"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {(activeProp === "width" || activeProp === "height") && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleApplyPreset("100%")}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border transition cursor-pointer ${
                specialVal === "100%"
                  ? "bg-sky-600 border-sky-400 text-white shadow"
                  : "bg-zinc-900 border-zinc-800 text-sky-400 hover:bg-zinc-800"
              }`}
            >
              100%
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset("auto")}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border transition cursor-pointer ${
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
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border transition cursor-pointer ${
                  specialVal === "100vh"
                    ? "bg-zinc-700 text-white border-zinc-500"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                100vh
              </button>
            )}
          </div>
        )}

        {activeProp === "opacity" && (
          <div className="flex items-center gap-1">
            {(["0", "0.5", "1"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border transition cursor-pointer ${
                  opacityVal === Number(p)
                    ? "bg-zinc-600 border-zinc-400 text-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <span className="text-[11px] font-mono font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-indigo-300 ml-auto">
          {activeProp === "opacity"
            ? opacityVal
            : specialVal
              ? specialVal
              : `${val}px`}
        </span>
      </div>

      {/* РЯД 3: ПОЛЗУНОК */}
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
        className="ubc-range w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}
