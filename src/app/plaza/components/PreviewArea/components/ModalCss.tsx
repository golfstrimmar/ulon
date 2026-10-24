"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { getGlobalScss, saveGlobalScss } from "@/lib/htmlStorage";

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
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (openModalCss) {
      getGlobalScss().then((code) => {
        setScssCode(code || "");
        setIsSaved(false);
      });
    }
  }, [openModalCss]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveGlobalScss(scssCode);

      // Оповещаем все компоненты
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: scssCode }),
      );

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error("[ModalCss] Failed to save SCSS to IndexedDB:", err);
    } finally {
      setIsSaving(false);
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
                Глобальный SCSS Редактор (styles.scss)
              </span>
              <span className="text-xs text-indigo-400 font-mono">
                (Поддержка вложенности, переменных $var, &:hover)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isSaved
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : "bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white shadow-lg"
                }`}
              >
                {isSaved ? "✓ Сохранено в базу" : "Сохранить (Ctrl+S)"}
              </button>

              <button
                type="button"
                onClick={() => setopenModalCss(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-red-600 border border-zinc-700 text-white text-sm font-bold flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
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
                fontSize: 13,
                fontFamily: "monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                formatOnPaste: true,
                lineNumbers: "on",
                wordWrap: "on",
              }}
            />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
