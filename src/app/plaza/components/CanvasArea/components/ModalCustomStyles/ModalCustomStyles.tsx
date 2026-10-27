"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TypographyControl } from "./components/TypographyControl";
import { PresetsList } from "./components/PresetsList";
import { ColorControl } from "./components/ColorControl";
import { DisplayControl } from "./components/DisplayControl";
import { PositionControl } from "./components/PositionControl";
import { TransformControl } from "./components/TransformControl";
import { UnifiedBoxControl } from "./components/UnifiedBoxControl";
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

  if (!currentClass) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsOpen((prev) => !prev)}
        className={`px-26 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer flex items-center gap-1 ${
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
            className="fixed right-0 bottom-0 mb-1 z-50 w-[400px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2.5 flex flex-col gap-2.5 backdrop-blur-md select-none"
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

            {/* Контейнер с подкомпонентами */}
            <div className="overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-0.5 ">
              <UnifiedBoxControl
                currentClass={currentClass}
                currentScssText={currentScssText}
                onApplySnippet={onApplySnippet}
              />
              <TypographyControl
                currentClass={currentClass}
                currentScssText={currentScssText}
                onApplySnippet={onApplySnippet}
              />

              {/* Блок Display */}
              <DisplayControl
                currentClass={currentClass}
                currentScssText={currentScssText}
                onApplySnippet={onApplySnippet}
              />

              {/* Блок Position */}
              <PositionControl
                currentClass={currentClass}
                currentScssText={currentScssText}
                onApplySnippet={onApplySnippet}
              />
              <ColorControl
                currentClass={currentClass}
                currentScssText={currentScssText}
                onApplySnippet={onApplySnippet}
              />
              {/* Блок Transform (Translate) */}
              <TransformControl
                currentClass={currentClass}
                currentScssText={currentScssText}
                onApplySnippet={onApplySnippet}
              />
              <PresetsList onApplySnippet={onApplySnippet} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
