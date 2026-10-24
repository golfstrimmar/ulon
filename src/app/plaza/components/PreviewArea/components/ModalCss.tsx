"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { getClassesCss, saveClassesCss } from "@/lib/htmlStorage";
import { parseClassesCss } from "@/lib/cssCompiler";

interface ModalCssProps {
  openModalCss: boolean;
  setopenModalCss: (open: boolean) => void;
}

export default function ModalCss({
  openModalCss,
  setopenModalCss,
}: ModalCssProps) {
  const [cssCode, setCssCode] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const editorRef = useRef<any>(null);

  // Читаем из IndexedDB при открытии модалки
  useEffect(() => {
    if (openModalCss) {
      getClassesCss().then((styles) => {
        const formatted = Object.entries(styles || {})
          .filter(([_, body]) => Boolean(body?.trim()))
          .map(([cls, body]) => `.${cls} {\n  ${body.trim()}\n}`)
          .join("\n\n");

        setCssCode(formatted);
        setIsSaved(false);
      });
    }
  }, [openModalCss]);

  // Сохранение в IndexedDB и уведомление приложения через шину
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const parsedStyles = parseClassesCss(cssCode);

      // 1. Сохраняем в изолированную таблицу IndexedDB
      await saveClassesCss(parsedStyles);

      // 2. Отправляем событие, чтобы превью и холст обновились в реальном времени
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: parsedStyles }),
      );

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error("[ModalCss] Failed to save CSS to IndexedDB:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Подключение горячей клавиши Ctrl+S / Cmd+S внутри Monaco
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
          {/* Шапка модалки */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold text-zinc-200">
                CSS Редактор классов
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                (IndexedDB: classes_css)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Кнопка сохранить */}
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

              {/* Кнопка закрыть */}
              <button
                type="button"
                onClick={() => setopenModalCss(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-red-600 border border-zinc-700 text-white text-sm font-bold flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Редактор Monaco */}
          <div className="flex-1 w-full rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-[#1e1e1e]">
            <Editor
              height="100%"
              defaultLanguage="css"
              theme="vs-dark"
              value={cssCode}
              onChange={(value) => setCssCode(value || "")}
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
