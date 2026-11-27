"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import ButtonClose from "@/components/ButtonClose";
import Spinner from "@/components/Spinner";
import { useTokensManager } from "@/app/plaza/components/CanvasArea/components/ModalTokens/hooks/useTokensManager";
import { TokenRow } from "@/app/plaza/components/CanvasArea/components/ModalTokens/components/TokenRow";

interface ModalTokensProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function ModalTokens({ isOpen, setIsOpen }: ModalTokensProps) {
  const {
    rootText,
    tokens,
    totalTokensCount,
    searchQuery,
    setSearchQuery,
    isSaving,
    isSaved,
    canUndo,
    canRedo,
    handleUpdateTokenValue,
    handleMonacoRootChange,
    handleSave,
    handleUndo,
    handleRedo,
    handleClearAllTokens,
  } = useTokensManager(isOpen);

  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  return (
    <AnimatePresence initial={false} mode="wait">
      {isOpen && (
        <motion.section
          key="modal-tokens"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 w-screen h-screen z-[1000] bg-zinc-950/95 backdrop-blur-md flex flex-col p-4 select-none"
        >
          {/* ══ Шапка модального окна ══ */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold text-zinc-200 flex items-center gap-2">
                <span className="text-indigo-400">🎛️</span>
                <span>Design Tokens Manager</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-mono">
                  {totalTokensCount} vars
                </span>
              </span>

              {/* Кнопки Undo / Redo */}
              <div className="flex items-center gap-1 pl-2 border-l border-zinc-800">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo revision"
                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-750 text-xs font-mono text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                >
                  <span>↶</span> Undo
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo revision"
                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-750 text-xs font-mono text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                >
                  <span>↷</span> Redo
                </button>
              </div>

              {/* Очистить все токены */}
              {totalTokensCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllTokens}
                  title="Clear all root tokens"
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-rose-950/60 border border-zinc-750 hover:border-rose-700 text-xs font-mono text-zinc-400 hover:text-rose-300 transition cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`min-w-[118px] px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer flex justify-center items-center gap-1.5 border ${
                  isSaved
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : "bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white shadow-lg"
                }`}
              >
                {isSaved ? <Spinner size={15} /> : "Save (Ctrl+S)"}
              </button>

              <ButtonClose setClose={setIsOpen} />
            </div>
          </div>

          {/* ══ Split-View: Визуальные контролы (слева) + Monaco Editor (справа) ══ */}
          <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
            {/* Левая панель: Интерактивные контролы и ползунки */}
            <div className="flex flex-col rounded-lg border border-zinc-800 bg-[#161618] overflow-hidden p-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80 gap-2">
                <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  Visual Controls & Sliders
                </span>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter variables..."
                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-750 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500 w-40 transition"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                {tokens.length > 0 ? (
                  tokens.map((token) => (
                    <TokenRow
                      key={token.id}
                      token={token}
                      onChangeValue={handleUpdateTokenValue}
                    />
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 font-mono text-xs">
                    <span className="text-2xl mb-2">🎛️</span>
                    <span>No CSS variables found in :root</span>
                    <span className="text-[11px] text-zinc-600 mt-1">
                      Add variables in the code editor on the right or add components with tokens.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Правая панель: Monaco Editor */}
            <div className="flex flex-col rounded-lg border border-zinc-800 bg-[#1e1e1e] overflow-hidden shadow-xl">
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 select-none">
                <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Code Editor (:root SCSS)</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  Live sync with sliders
                </span>
              </div>

              <div className="flex-1 w-full overflow-hidden">
                <Editor
                  height="100%"
                  language="scss"
                  theme="vs-dark"
                  value={rootText}
                  onChange={(value) => handleMonacoRootChange(value || "")}
                  onMount={handleEditorDidMount}
                  options={{
                    fontSize: 13,
                    fontFamily: "monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    formatOnPaste: true,
                    lineNumbers: "on",
                    wordWrap: "on",
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
