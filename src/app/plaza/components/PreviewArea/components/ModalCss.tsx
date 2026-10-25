"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { getGlobalScss, saveGlobalScss } from "@/lib/htmlStorage";
import { styleHistory } from "@/lib/styleHistory";
import Spinner from "@/components/Spinner";
import ButtonClose from "@/components/ButtonClose";

interface ModalCssProps {
  openModalCss: boolean;
  setopenModalCss: (open: boolean) => void;
}

export default function ModalCss({
  openModalCss,
  setopenModalCss,
}: ModalCssProps) {
  const [scssCode, setScssCode] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const editorRef = useRef<any>(null);

  // Загрузка начального кода и подписка на состояние истории
  useEffect(() => {
    if (openModalCss) {
      getGlobalScss().then((code) => {
        const val = code || "";
        setScssCode(val);
        setIsSaved(false);
        setCanUndo(styleHistory.canUndo());
        setCanRedo(styleHistory.canRedo());
      });
    }

    const handleHistoryUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{
        canUndo: boolean;
        canRedo: boolean;
      }>;
      if (customEvent.detail) {
        setCanUndo(customEvent.detail.canUndo);
        setCanRedo(customEvent.detail.canRedo);
      }
    };

    window.addEventListener("plaza-style-history-changed", handleHistoryUpdate);
    return () => {
      window.removeEventListener(
        "plaza-style-history-changed",
        handleHistoryUpdate,
      );
    };
  }, [openModalCss]);

  // Сохранение (Save)
  const handleSave = async (codeToSave = scssCode) => {
    try {
      setIsSaving(true);
      styleHistory.record(codeToSave); // 🔹 Фиксируем шаг в истории
      await saveGlobalScss(codeToSave);

      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: codeToSave }),
      );

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 800);
    } catch (err) {
      console.error("[ModalCss] Failed to save SCSS to IndexedDB:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // 🔹 Откат назад (Undo)
  const handleUndo = async () => {
    const prevScss = styleHistory.undo();
    if (prevScss !== null) {
      setScssCode(prevScss);
      await saveGlobalScss(prevScss);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: prevScss }),
      );
    }
  };

  // 🔹 Возврат вперед (Redo)
  const handleRedo = async () => {
    const nextScss = styleHistory.redo();
    if (nextScss !== null) {
      setScssCode(nextScss);
      await saveGlobalScss(nextScss);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: nextScss }),
      );
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  return (
    <AnimatePresence initial={false} mode="wait">
      {openModalCss && (
        <motion.section
          key="modal-css"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 w-screen h-screen z-[1000] bg-zinc-950/95 backdrop-blur-md flex flex-col p-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold text-zinc-200">
                SCSS Editor
              </span>

              {/* 🔹 Кнопки Undo / Redo для сохраненных ревизий стилей */}
              <div className="flex items-center gap-1 pl-2 border-l border-zinc-800">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo saved revision"
                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-750 text-xs font-mono text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                >
                  <span>↶</span> Undo
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo saved revision"
                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-750 text-xs font-mono text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                >
                  <span>↷</span> Redo
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving}
                className={`min-w-[118px] px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer flex justify-center items-center gap-1.5 border ${
                  isSaved
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : "bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white shadow-lg"
                }`}
              >
                {isSaved ? <Spinner size={15} /> : "Save (Ctrl+S)"}
              </button>

              <ButtonClose setClose={setopenModalCss} />
            </div>
          </div>

          <div className="flex-1 w-full rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-[#1e1e1e]">
            <Editor
              height="100%"
              language="scss"
              theme="vs-dark"
              value={scssCode}
              onChange={(value) => setScssCode(value || "")}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 14,
                fontFamily: "monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                formatOnPaste: true,
                lineNumbers: "on",
                wordWrap: "on",
                padding: { top: 10, bottom: 10 },
              }}
            />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
