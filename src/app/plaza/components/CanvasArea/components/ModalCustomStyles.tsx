"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  STYLE_PRESETS,
  LIVE_STYLE_ID,
} from "@/app/plaza/components/CanvasArea/constants/theme";

type SpacingType = "padding" | "margin" | "border-radius";
type SpacingSide = "all" | "top" | "right" | "bottom" | "left";
type TypoProp = "font-size" | "line-height" | "letter-spacing";

interface ModalCustomStylesProps {
  currentClass: string | null;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

export default function ModalCustomStyles({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: ModalCustomStylesProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 🔹 Состояние для Gap
  const [gapMode, setGapMode] = useState<"gap" | "row-gap" | "column-gap">(
    "gap",
  );
  const [gapVal, setGapVal] = useState<number>(0);

  // 🔹 Состояние для Padding / Margin
  const [spacingType, setSpacingType] = useState<SpacingType>("padding");
  const [spacingSide, setSpacingSide] = useState<SpacingSide>("all");
  const [spacingVal, setSpacingVal] = useState<number>(0);

  // 🔹 Состояние для Типографики (Font-Size, Line-Height, Letter-Spacing)
  const [typoProp, setTypoProp] = useState<TypoProp>("font-size");
  const [typoVal, setTypoVal] = useState<number>(16);

  const isDraggingRef = useRef(false);

  // 🔹 Парсер: вытаскивает реальное число свойства из текста класса
  const extractNumericProp = useCallback(
    (propName: string, scssText: string): number => {
      const regex = new RegExp(
        `${propName}\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)px`,
        "i",
      );
      const match = scssText.match(regex);
      return match ? parseFloat(match[1]) : 0;
    },
    [],
  );

  const getComputedSpacingProp = (type: SpacingType, side: SpacingSide) => {
    return side === "all" ? type : `${type}-${side}`;
  };

  // 🔹 Лимиты для типографики
  const getTypoLimits = (prop: TypoProp) => {
    switch (prop) {
      case "font-size":
        return { min: 8, max: 96, step: 1, defaultVal: 16 };
      case "line-height":
        return { min: 8, max: 120, step: 1, defaultVal: 24 };
      case "letter-spacing":
        return { min: -2, max: 20, step: 0.5, defaultVal: 0 };
    }
  };

  // 🔹 Синхронизация значений при открытии модалки или смене класса
  useEffect(() => {
    if (!isOpen || !currentScssText) return;
    const prop = getComputedSpacingProp(spacingType, spacingSide);
    setSpacingVal(extractNumericProp(prop, currentScssText));
    setGapVal(extractNumericProp(gapMode, currentScssText));

    const existingTypo = extractNumericProp(typoProp, currentScssText);
    setTypoVal(existingTypo || getTypoLimits(typoProp).defaultVal);
  }, [
    isOpen,
    currentClass,
    currentScssText,
    spacingType,
    spacingSide,
    gapMode,
    typoProp,
    extractNumericProp,
  ]);

  // 🔹 Инжект стиля в iframe
  const applyLiveStyle = useCallback(
    (selector: string, prop: string, numVal: number) => {
      const cssRule = `.${selector} { ${prop}: ${numVal}px !important; }`;

      const inject = (doc: Document) => {
        if (!doc.head) return;
        let tag = doc.getElementById(LIVE_STYLE_ID) as HTMLStyleElement | null;
        if (!tag) {
          tag = doc.createElement("style");
          tag.id = LIVE_STYLE_ID;
          doc.head.appendChild(tag);
        }
        tag.textContent = cssRule;
      };

      inject(document);
      document.querySelectorAll("iframe").forEach((iframe) => {
        try {
          if (iframe.contentDocument) inject(iframe.contentDocument);
        } catch {}
      });
    },
    [],
  );

  const removeLiveStyle = useCallback(() => {
    document.getElementById(LIVE_STYLE_ID)?.remove();
    document.querySelectorAll("iframe").forEach((iframe) => {
      try {
        iframe.contentDocument?.getElementById(LIVE_STYLE_ID)?.remove();
      } catch {}
    });
  }, []);

  useEffect(() => {
    return () => removeLiveStyle();
  }, [removeLiveStyle]);

  /* ==========================================================================
     ПЕРЕКЛЮЧЕНИЕ СТОРОН И ТИПОВ БЕЗ ПЕРЕБРОСА СТАРОГО ЗНАЧЕНИЯ
     ========================================================================== */
  const handleSelectSide = (newSide: SpacingSide) => {
    removeLiveStyle();
    setSpacingSide(newSide);
    const prop = getComputedSpacingProp(spacingType, newSide);
    const existingVal = extractNumericProp(prop, currentScssText);
    setSpacingVal(existingVal);
  };

  const handleSelectType = (newType: SpacingType) => {
    removeLiveStyle();
    setSpacingType(newType);
    const prop = getComputedSpacingProp(newType, spacingSide);
    const existingVal = extractNumericProp(prop, currentScssText);
    setSpacingVal(existingVal);
  };

  const handleSelectGapMode = (newMode: "gap" | "row-gap" | "column-gap") => {
    removeLiveStyle();
    setGapMode(newMode);
    const existingVal = extractNumericProp(newMode, currentScssText);
    setGapVal(existingVal);
  };

  const handleSelectTypoProp = (newProp: TypoProp) => {
    removeLiveStyle();
    setTypoProp(newProp);
    const existingVal = extractNumericProp(newProp, currentScssText);
    setTypoVal(existingVal || getTypoLimits(newProp).defaultVal);
  };

  /* ==========================================================================
     SLIDERS HANDLERS (0 ms Live + Single Commit)
     ========================================================================== */
  const handleSpacingSliderInput = (newVal: number) => {
    isDraggingRef.current = true;
    setSpacingVal(newVal);
    if (currentClass) {
      const prop = getComputedSpacingProp(spacingType, spacingSide);
      applyLiveStyle(currentClass, prop, newVal);
    }
  };

  const handleSpacingSliderCommit = () => {
    isDraggingRef.current = false;
    const prop = getComputedSpacingProp(spacingType, spacingSide);
    onApplySnippet(`${prop}: ${spacingVal}px;`);
  };

  const handleGapSliderInput = (newVal: number) => {
    isDraggingRef.current = true;
    setGapVal(newVal);
    if (currentClass) {
      applyLiveStyle(currentClass, gapMode, newVal);
    }
  };

  const handleGapSliderCommit = () => {
    isDraggingRef.current = false;
    onApplySnippet(`${gapMode}: ${gapVal}px;`);
  };

  const handleTypoSliderInput = (newVal: number) => {
    isDraggingRef.current = true;
    setTypoVal(newVal);
    if (currentClass) {
      applyLiveStyle(currentClass, typoProp, newVal);
    }
  };

  const handleTypoSliderCommit = () => {
    isDraggingRef.current = false;
    onApplySnippet(`${typoProp}: ${typoVal}px;`);
  };

  if (!currentClass) return null;

  const currentTypoLimits = getTypoLimits(typoProp);

  return (
    <div className="relative inline-block">
      {/* Кнопка открытия пресетов */}
      <button
        type="button"
        onMouseEnter={() => setIsOpen((prev) => !prev)}
        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer flex items-center gap-1 ${
          isOpen
            ? "bg-indigo-600 border-indigo-400 text-white shadow"
            : "bg-zinc-900 border-zinc-700 text-indigo-300 hover:bg-zinc-800 hover:border-indigo-500"
        }`}
        title="Добавить готовые CSS свойства"
      >
        <span>🎨</span>
        <span>+ Presets</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed right-0 bottom-full mb-1 z-50 w-[400px]  bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2.5 flex flex-col gap-2.5 backdrop-blur-md select-none"
          >
            {/* Шапка */}
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <span className="text-[12px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Add to <code className="text-emerald-400">.{currentClass}</code>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-white text-xs cursor-pointer p-0.5"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-0.5 ">
              {/* 🔹 БЛОК 1: PADDING & MARGIN (ПО КРУГУ) */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => handleSelectType("padding")}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                        spacingType === "padding"
                          ? "bg-emerald-600 text-white shadow"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Padding
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectType("margin")}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                        spacingType === "margin"
                          ? "bg-amber-600 text-white shadow"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Margin
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectType("border-radius")}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                        spacingType === "border-radius"
                          ? "bg-amber-600 text-white shadow"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      border-radius
                    </button>
                  </div>

                  <span
                    className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                      spacingType === "padding"
                        ? "text-emerald-400 border-emerald-900/60 bg-emerald-950/40"
                        : "text-amber-400 border-amber-900/60 bg-amber-950/40"
                    }`}
                  >
                    {spacingVal}px
                  </span>
                </div>

                {/* Выбор стороны */}
                <div className="grid grid-cols-5 gap-1">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "top", label: "Top" },
                      { id: "right", label: "Right" },
                      { id: "bottom", label: "Btm" },
                      { id: "left", label: "Left" },
                    ] as const
                  ).map((side) => (
                    <button
                      key={side.id}
                      type="button"
                      onClick={() => handleSelectSide(side.id)}
                      className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer text-center ${
                        spacingSide === side.id
                          ? spacingType === "padding"
                            ? "bg-emerald-600 border-emerald-400 text-white shadow-sm"
                            : "bg-amber-600 border-amber-400 text-white shadow-sm"
                          : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {side.label}
                    </button>
                  ))}
                </div>

                {/* Ползунок Padding / Margin */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={0}
                    max={160}
                    step={1}
                    value={spacingVal}
                    onPointerDown={() => {
                      isDraggingRef.current = true;
                    }}
                    onInput={(e) => {
                      handleSpacingSliderInput(
                        Number((e.target as HTMLInputElement).value),
                      );
                    }}
                    onChange={(e) => {
                      handleSpacingSliderInput(Number(e.target.value));
                    }}
                    onPointerUp={handleSpacingSliderCommit}
                    onPointerCancel={handleSpacingSliderCommit}
                    className={`w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer ${
                      spacingType === "padding"
                        ? "accent-emerald-500"
                        : "accent-amber-500"
                    }`}
                  />
                </div>
              </div>

              {/* 🔹 БЛОК 2: TYPOGRAPHY (FONT-SIZE, LINE-HEIGHT, LETTER-SPACING) */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                    Typography:
                  </span>
                  <span className="text-[11px] font-mono text-purple-400 font-bold bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-700">
                    {typoVal}px
                  </span>
                </div>

                {/* Переключатель свойств текста */}
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "font-size", label: "Size" },
                      { id: "line-height", label: "Line H" },
                      { id: "letter-spacing", label: "Letter" },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => handleSelectTypoProp(btn.id)}
                      className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer text-center ${
                        typoProp === btn.id
                          ? "bg-purple-600 border-purple-400 text-white shadow-sm"
                          : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Ползунок Typography */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={currentTypoLimits.min}
                    max={currentTypoLimits.max}
                    step={currentTypoLimits.step}
                    value={typoVal}
                    onPointerDown={() => {
                      isDraggingRef.current = true;
                    }}
                    onInput={(e) => {
                      handleTypoSliderInput(
                        Number((e.target as HTMLInputElement).value),
                      );
                    }}
                    onChange={(e) => {
                      handleTypoSliderInput(Number(e.target.value));
                    }}
                    onPointerUp={handleTypoSliderCommit}
                    onPointerCancel={handleTypoSliderCommit}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>

              {/* 🔹 БЛОК 3: GAP SPACING */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                    Gap spacing:
                  </span>
                  <span className="text-[11px] font-mono text-indigo-400 font-bold bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-700">
                    {gapVal}px
                  </span>
                </div>

                {/* Кнопки режима Gap */}
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "gap", label: "Both" },
                      { id: "row-gap", label: "Rows" },
                      { id: "column-gap", label: "Cols" },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => handleSelectGapMode(btn.id)}
                      className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer text-center ${
                        gapMode === btn.id
                          ? "bg-indigo-600 border-indigo-400 text-white shadow-sm"
                          : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Ползунок Gap */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={0}
                    max={120}
                    step={1}
                    value={gapVal}
                    onPointerDown={() => {
                      isDraggingRef.current = true;
                    }}
                    onInput={(e) => {
                      handleGapSliderInput(
                        Number((e.target as HTMLInputElement).value),
                      );
                    }}
                    onChange={(e) => {
                      handleGapSliderInput(Number(e.target.value));
                    }}
                    onPointerUp={handleGapSliderCommit}
                    onPointerCancel={handleGapSliderCommit}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>

              {/* 🔹 БЛОК 4: СПИСОК ОСТАЛЬНЫХ ПРЕСЕТОВ */}
              <div className="flex flex-col gap-2">
                {STYLE_PRESETS.map((group) => (
                  <div key={group.category} className="flex flex-col gap-1">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 font-bold tracking-wider">
                      {group.category}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {group.items.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => onApplySnippet(preset.css)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-indigo-600 hover:text-white border border-zinc-750 text-zinc-200 text-[10px] font-mono transition text-left cursor-pointer flex-1 min-w-[95px]"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
