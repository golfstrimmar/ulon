"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LIVE_STYLE_ID = "__plaza_live_quick_style__";

interface StylePreset {
  name: string;
  css: string;
}

const STYLE_PRESETS: { category: string; items: StylePreset[] }[] = [
  {
    category: "Layout",
    items: [
      { name: "Flex", css: "display: flex;\nflex-direction: row;" },
      { name: "Flex col", css: "display: flex;\nflex-direction: column;" },
      {
        name: "Center",
        css: "display: flex;\nalign-items: center;\njustify-content: center;",
      },
      {
        name: "Between",
        css: "display: flex;\nalign-items: center;\njustify-content: space-between;",
      },
      {
        name: "Grid 2 Cols",
        css: "display: grid;\ngrid-template-columns: repeat(2, 1fr);",
      },
    ],
  },
  {
    category: "Visuals",
    items: [
      {
        name: "Soft Shadow",
        css: "box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.25);",
      },
      {
        name: "Glow Blue",
        css: "box-shadow: 0 0 15px rgba(56, 189, 248, 0.5);",
      },
      {
        name: "Glassmorphism",
        css: "background: rgba(255, 255, 255, 0.05);\nbackdrop-filter: blur(10px);\nborder: 1px solid rgba(255, 255, 255, 0.1);",
      },
    ],
  },
  {
    category: "Effects",
    items: [
      {
        name: "Hover Scale",
        css: "transition: transform 0.2s ease;\n&:hover {\n  transform: scale(1.04);\n}",
      },
      {
        name: "Gradient BG",
        css: "background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);\ncolor: #ffffff;",
      },
      {
        name: "Truncate text",
        css: "overflow: hidden;\ntext-overflow: ellipsis;\nwhite-space: nowrap;",
      },
    ],
  },
];

interface ModalCustomStylesProps {
  currentClass: string | null;
  onApplySnippet: (snippetCss: string) => void;
}

export default function ModalCustomStyles({
  currentClass,
  onApplySnippet,
}: ModalCustomStylesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gapMode, setGapMode] = useState<"gap" | "row-gap" | "column-gap">(
    "gap",
  );
  const [val, setVal] = useState<number>(16);

  const isDraggingRef = useRef(false);

  // 🔹 Инжектим стиль напрямую в iframe (из BoxModelSpacing)
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

  // Пока тянем ползунок (onInput / onChange) — только живой инжект
  const handleSliderInput = (newVal: number) => {
    isDraggingRef.current = true;
    setVal(newVal);
    if (currentClass) {
      applyLiveStyle(currentClass, gapMode, newVal);
    }
  };

  // Отпустили мышь — просто сохраняем в SCSS (без преждевременного удаления стиля!)
  const handleSliderCommit = () => {
    isDraggingRef.current = false;
    onApplySnippet(`${gapMode}: ${val}px;`);
  };

  if (!currentClass) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
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
            className="fixed right-0 bottom-full mb-1 z-50 w-72 max-h-[460px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2.5 flex flex-col gap-2.5 backdrop-blur-md select-none"
          >
            {/* Шапка */}
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <span className="text-[12px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Add to <code className="text-emerald-400">.{currentClass}</code>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 🔹 БЛОК GAP (по паттерну BoxModelSpacing) */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                  Gap spacing:
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-700">
                  {val}px
                </span>
              </div>

              {/* Кнопки режима */}
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
                    onClick={() => {
                      setGapMode(btn.id);
                      onApplySnippet(`${btn.id}: ${val}px;`);
                    }}
                    className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer text-center ${
                      gapMode === btn.id
                        ? "bg-indigo-600 border-indigo-400 text-white"
                        : "bg-zinc-850 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Ползунок с событиями onInput и onPointerUp */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={1}
                  value={val}
                  onPointerDown={() => {
                    isDraggingRef.current = true;
                  }}
                  onInput={(e) => {
                    handleSliderInput(
                      Number((e.target as HTMLInputElement).value),
                    );
                  }}
                  onChange={(e) => {
                    handleSliderInput(Number(e.target.value));
                  }}
                  onPointerUp={handleSliderCommit}
                  onPointerCancel={handleSliderCommit}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* СПИСОК ПРЕСЕТОВ */}
            <div className="overflow-y-auto custom-scrollbar flex flex-col gap-2  pr-0.5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
