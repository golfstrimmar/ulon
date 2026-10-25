"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { getGlobalJs, saveGlobalJs } from "@/lib/htmlStorage";

interface ModalJsProps {
  openModalJs: boolean;
  setOpenModalJs: (open: boolean) => void;
}

export default function ModalJs({ openModalJs, setOpenModalJs }: ModalJsProps) {
  const [jsCode, setJsCode] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const editorRef = useRef<any>(null);

  // Загружаем бандл напрямую из базы
  useEffect(() => {
    if (openModalJs) {
      getGlobalJs().then((bundle) => {
        setJsCode(bundle || "");
        setIsSaved(false);
      });
    }
  }, [openModalJs]);

  // Сохраняем бандл в IndexedDB
  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveGlobalJs(jsCode);

      // Оповещаем все компоненты и превью
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: jsCode }),
      );

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error("[ModalJs] Failed to save JS bundle to IndexedDB:", err);
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
      {openModalJs && (
        <motion.section
          key="modal-js"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 w-screen h-screen z-[1000] bg-zinc-950/95 backdrop-blur-md flex flex-col p-4 select-none"
        >
          {/* Шапка модалки */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <span className="text-sm font-mono font-bold text-amber-300 flex items-center gap-1.5">
              <span>⚡</span> JavaScript Бандл (scripts.js)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`px-3.5 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isSaved
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : "bg-amber-600 hover:bg-amber-500 border-amber-400 text-white shadow-lg"
                }`}
              >
                {isSaved ? "✓ Сохранено в базу" : "Сохранить (Ctrl+S)"}
              </button>

              <button
                type="button"
                onClick={() => setOpenModalJs(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-red-600 border border-zinc-700 text-white text-sm font-bold flex items-center justify-center transition-all cursor-pointer ml-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Редактор Monaco */}
          <div className="flex-1 w-full rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-[#1e1e1e]">
            <Editor
              height="100%"
              language="javascript"
              theme="vs-dark"
              value={jsCode}
              onChange={(value) => setJsCode(value || "")}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 13,
                fontFamily: "var(--font-mono), monospace",
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
