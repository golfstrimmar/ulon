"use client";

import React from "react";
import type { ModalActiveScopeStylesProps } from "./types/modalActiveScopeStyles.types";
import { useModalActiveScopeStylesController } from "./controllers/useModalActiveScopeStylesController";
import { DisplayControl } from "./components/DisplayControl";
import { UnifiedBoxControl } from "./components/UnifiedBoxControl";
import { ColorControl } from "./components/ColorControl";
import { TypographyControl } from "./components/TypographyControl";
import { PositionControl } from "./components/PositionControl";
import { TransformControl } from "./components/TransformControl";
import { PresetsList } from "./components/PresetsList";

export default function ModalActiveScopeStyles({
  isOpen,
  currentClass,
  activeScope = "base",
  currentScssText = "",
  onApplySnippet,
  onClose,
  onSelectScope,
}: ModalActiveScopeStylesProps) {
  const {
    headerInfo,
    effectiveScssText,
    handleScopedApplySnippet,
    handleBackToBase,
    handleClose,
  } = useModalActiveScopeStylesController({
    currentClass,
    activeScope,
    currentScssText,
    onApplySnippet,
    onClose,
    onSelectScope,
  });

  if (!isOpen || !currentClass) return null;

  return (
    <div className="fixed right-0 bottom-0 mb-1 z-50 w-[420px] max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2.5 flex flex-col gap-2.5 backdrop-blur-md select-none">
      {/* Шапка модалки */}
      <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono text-zinc-400 tracking-wider font-semibold flex gap-2">
              {headerInfo.type === "base" ? (
                <code className="text-emerald-400 font-bold">
                  .{headerInfo.currentClass}
                </code>
              ) : headerInfo.type === "media" ? (
                <span className="font-mono text-sky-400 font-bold flex items-center gap-1.5 flex-wrap">
                  <code>.{headerInfo.currentClass}</code>
                  <span className="text-sky-300 bg-sky-950/80 border border-sky-600/70 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                    {headerInfo.mediaName && (
                      <span className="font-bold text-sky-400">
                        {headerInfo.mediaName}
                      </span>
                    )}
                    <span className="font-semibold text-white">
                      {headerInfo.mediaSegment}
                    </span>
                    <span className="text-[9px] text-zinc-400 opacity-80 font-mono ml-1">
                      {headerInfo.scope}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="font-mono text-amber-400 font-bold">
                  .{headerInfo.currentClass}{" "}
                  <span className="text-amber-300 bg-amber-950/80 border border-amber-600/70 px-1 py-0.5 rounded text-[10px]">
                    {headerInfo.scope}
                  </span>
                </span>
              )}
            </span>
          </div>
          {headerInfo.type !== "base" && (
            <button
              type="button"
              onClick={handleBackToBase}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 cursor-pointer transition mt-0.5"
              title="Переключиться на редактирование базового класса"
            >
              ← Base
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="text-zinc-500 hover:text-white text-xs cursor-pointer p-0.5"
        >
          ✕
        </button>
      </div>

      {/* Контейнер с подкомпонентами стилей */}
      <div className="overflow-y-auto custom-scrollbar flex flex-col gap-2.5 ">
        <DisplayControl
          currentClass={currentClass}
          currentScssText={effectiveScssText}
          onApplySnippet={handleScopedApplySnippet}
        />
        <UnifiedBoxControl
          currentClass={currentClass}
          currentScssText={effectiveScssText}
          onApplySnippet={handleScopedApplySnippet}
        />
        <ColorControl
          currentClass={currentClass}
          currentScssText={effectiveScssText}
          onApplySnippet={handleScopedApplySnippet}
        />
        <TypographyControl
          currentClass={currentClass}
          currentScssText={effectiveScssText}
          onApplySnippet={handleScopedApplySnippet}
        />
        <PositionControl
          currentClass={currentClass}
          currentScssText={effectiveScssText}
          onApplySnippet={handleScopedApplySnippet}
        />
        <TransformControl
          currentClass={currentClass}
          currentScssText={effectiveScssText}
          onApplySnippet={handleScopedApplySnippet}
        />
        <PresetsList onApplySnippet={handleScopedApplySnippet} />
      </div>
    </div>
  );
}
