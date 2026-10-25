"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import ModalCustomStyles from "@/app/plaza/components/CanvasArea/components/ModalCustomStyles";

import {
  extractClassSnippet,
  updateClassInGlobalScss,
} from "@/lib/scssCompiler";
import { motion, AnimatePresence } from "framer-motion";
import ButtonUndoRedoScss from "@/components/ButtonUndoRedoScss";

// 🔹 Динамический импорт самого Monaco Editor (подгрузится только по клику на класс/атрибуты)
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[160px] w-full flex items-center justify-center bg-zinc-950 text-xs font-mono text-zinc-500">
      <span className="animate-pulse">Loading editor...</span>
    </div>
  ),
});

interface MonacoPropertiesEditorProps {
  nodeKey?: string;
  nodeTag?: string;
  nodeClasses: string[];
  globalScss: string;
  attributesValue?: Record<string, string>;
  onSaveGlobalScss: (nextScss: string) => Promise<void> | void;
  onSaveAttributes?: (
    attributes: Record<string, string>,
  ) => Promise<void> | void;
}

function ensureSelectorWrapper(className: string, code: string): string {
  const cls = className.trim().replace(/^\./, "");
  const trimmed = (code || "").trim();
  if (!cls) return trimmed;
  if (!trimmed) return `.${cls} {\n  \n}`;

  const regex = new RegExp(`^\\.${cls}[\\s\\{\\:\\.]`);
  if (regex.test(trimmed)) {
    return trimmed;
  }

  return `.${cls} {\n  ${trimmed
    .split("\n")
    .map((l) => (l.trim() ? `  ${l}` : ""))
    .join("\n")}\n}`;
}

export function MonacoPropertiesEditor({
  nodeTag = "div",
  nodeClasses = [],
  globalScss = "",
  attributesValue = {},
  onSaveGlobalScss,
  onSaveAttributes,
}: MonacoPropertiesEditorProps) {
  const [openTarget, setOpenTarget] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState<string>("");
  const currentTextRef = useRef<string>("");
  currentTextRef.current = currentText;

  const isDirtyRef = useRef<boolean>(false);

  const globalScssRef = useRef<string>(globalScss);
  globalScssRef.current = globalScss;

  useEffect(() => {
    if (!openTarget) {
      setCurrentText("");
      currentTextRef.current = "";
      isDirtyRef.current = false;
      return;
    }

    if (isDirtyRef.current) return;

    if (openTarget === "__attributes__") {
      const formatted = JSON.stringify(attributesValue || {}, null, 2);
      if (formatted !== currentTextRef.current) {
        setCurrentText(formatted);
        currentTextRef.current = formatted;
      }
    } else {
      const freshSnippet = extractClassSnippet(globalScss, openTarget);
      if (freshSnippet !== currentTextRef.current) {
        setCurrentText(freshSnippet);
        currentTextRef.current = freshSnippet;
      }
    }
  }, [globalScss, openTarget, attributesValue]);

  const saveCurrentOpenTarget = (targetToSave: string | null = openTarget) => {
    if (!targetToSave || !isDirtyRef.current) return;

    if (targetToSave === "__attributes__") {
      try {
        const parsed = JSON.parse(currentTextRef.current || "{}");
        if (typeof parsed === "object" && parsed !== null && onSaveAttributes) {
          onSaveAttributes(parsed);
        }
      } catch (err) {
        console.warn("[MonacoPropertiesEditor] Invalid JSON attributes:", err);
      }
    } else {
      const preparedCode = ensureSelectorWrapper(
        targetToSave,
        currentTextRef.current,
      );
      const nextScss = updateClassInGlobalScss(
        globalScssRef.current,
        targetToSave,
        preparedCode,
      );
      globalScssRef.current = nextScss;
      onSaveGlobalScss(nextScss);
    }

    isDirtyRef.current = false;
  };

  const handleToggleClass = (cls: string) => {
    const clean = cls.trim().replace(/^\./, "");
    if (!clean) return;

    if (openTarget === clean) {
      saveCurrentOpenTarget(clean);
      setOpenTarget(null);
      return;
    }

    if (openTarget) {
      saveCurrentOpenTarget(openTarget);
    }

    const snippet = extractClassSnippet(globalScssRef.current, clean);
    setCurrentText(snippet);
    currentTextRef.current = snippet;
    isDirtyRef.current = false;
    setOpenTarget(clean);
  };

  const handleToggleAttributes = () => {
    if (openTarget === "__attributes__") {
      saveCurrentOpenTarget("__attributes__");
      setOpenTarget(null);
      return;
    }

    if (openTarget) {
      saveCurrentOpenTarget(openTarget);
    }

    const jsonStr = JSON.stringify(attributesValue || {}, null, 2);
    setCurrentText(jsonStr);
    currentTextRef.current = jsonStr;
    isDirtyRef.current = false;
    setOpenTarget("__attributes__");
  };

  const handleDeleteCurrentClassCss = () => {
    if (!openTarget || openTarget === "__attributes__") return;
    const targetToDelete = openTarget;

    setCurrentText("");
    currentTextRef.current = "";
    isDirtyRef.current = false;

    const nextScss = updateClassInGlobalScss(
      globalScssRef.current,
      targetToDelete,
      "",
    );
    globalScssRef.current = nextScss;
    onSaveGlobalScss(nextScss);
    setOpenTarget(null);
  };

  const handleCloseEditor = () => {
    saveCurrentOpenTarget();
    setOpenTarget(null);
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editor.onDidBlurEditorText(() => {
      saveCurrentOpenTarget();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCurrentOpenTarget();
    });
  };

  // 🔹 УДАЛЕНИЕ ВЗАИМОИСКЛЮЧАЮЩИХ CSS СВОЙСТВ
  const cleanConflictingProperties = (
    existingCss: string,
    newSnippet: string,
  ): string => {
    // 1. Извлекаем имена свойств, которые приходят в новом сниппете (например: "display", "justify-content")
    const newPropertyNames: string[] = [];
    const propRegex = /([a-zA-Z0-9_-]+)\s*:/g;
    let match: RegExpExecArray | null;

    while ((match = propRegex.exec(newSnippet)) !== null) {
      newPropertyNames.push(match[1].toLowerCase());
    }
    // Если ставим общий gap: — чистим частные row-gap и column-gap
    if (newPropertyNames.includes("gap")) {
      newPropertyNames.push("row-gap", "column-gap");
    }
    // Если ставим частный row-gap или column-gap — удаляем общий gap
    if (
      newPropertyNames.includes("row-gap") ||
      newPropertyNames.includes("column-gap")
    ) {
      newPropertyNames.push("gap");
    }
    // Если добавляем Grid — подчищаем связанные свойства Flex (flex-direction, align-items и т.д.)
    if (newSnippet.includes("display: grid")) {
      newPropertyNames.push("flex-direction", "flex-wrap");
    }

    // Если добавляем Flex — подчищаем свойства Grid
    if (newSnippet.includes("display: flex")) {
      newPropertyNames.push(
        "grid-template-columns",
        "grid-template-rows",
        "grid-auto-flow",
      );
    }

    // 2. Построчно фильтруем существующий CSS, удаляя старые конфликтующие строки
    let lines = existingCss.split("\n");

    lines = lines.filter((line) => {
      const trimmed = line.trim();
      // Не трогаем скобки и селекторы
      if (
        !trimmed ||
        trimmed.startsWith(".") ||
        trimmed.startsWith("&") ||
        trimmed === "}"
      ) {
        return true;
      }

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex !== -1) {
        const propName = trimmed.slice(0, colonIndex).trim().toLowerCase();
        // Если это свойство перезаписывается новым пресетом — выкидываем старую строку
        if (newPropertyNames.includes(propName)) {
          return false;
        }
      }
      return true;
    });

    return lines.join("\n");
  };

  // 🔹 ВСТАВКА СНИППЕТА С АВТОМАТИЧЕСКИМ РАЗРЕШЕНИЕМ КОНФЛИКТОВ
  const handleApplySnippet = (snippetCss: string) => {
    if (!openTarget || openTarget === "__attributes__") return;

    let text = currentTextRef.current.trim();

    // 1. Сначала вычищаем все конфликтующие свойства из текущего кода
    if (text) {
      text = cleanConflictingProperties(text, snippetCss);
    }

    // 2. Вставляем новый пресет
    if (
      !text ||
      text === `.${openTarget} {\n  \n}` ||
      text === `.${openTarget} {}`
    ) {
      text = `.${openTarget} {\n  ${snippetCss}\n}`;
    } else if (text.endsWith("}")) {
      const lastBraceIndex = text.lastIndexOf("}");
      const before = text.slice(0, lastBraceIndex).trimEnd();
      text = `${before}\n  ${snippetCss.split("\n").join("\n  ")}\n}`;
    } else {
      text = `${text}\n  ${snippetCss}`;
    }

    // 3. Синхронизируем состояние Monaco
    setCurrentText(text);
    currentTextRef.current = text;
    isDirtyRef.current = false;

    // 4. Оборачиваем и пишем в общий бандл
    const preparedCode = ensureSelectorWrapper(openTarget, text);
    const nextScss = updateClassInGlobalScss(
      globalScssRef.current,
      openTarget,
      preparedCode,
    );
    globalScssRef.current = nextScss;

    // 5. Сохраняем в IndexedDB и пишем в историю Undo
    onSaveGlobalScss(nextScss);
  };
  const attrsCount = useMemo(() => {
    return Object.keys(attributesValue || {}).length;
  }, [attributesValue]);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-wrap justify-between items-center gap-1.5 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
        {/* Classes section */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mr-1 shrink-0">
            Classes:
          </span>

          {nodeClasses.length > 0 ? (
            nodeClasses.map((cls) => {
              const isOpen = openTarget === cls;
              const hasSnippet = globalScss.includes(`.${cls}`);

              return (
                <button
                  key={cls}
                  type="button"
                  onMouseEnter={() => handleToggleClass(cls)}
                  title={`Edit SCSS for .${cls}`}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 ${
                    isOpen
                      ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow"
                      : hasSnippet
                        ? "bg-zinc-900 border-zinc-700 text-emerald-400 hover:bg-zinc-800"
                        : "bg-zinc-900 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <span>.{cls}</span>
                  {hasSnippet && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })
          ) : (
            <span className="text-[11px] font-mono text-zinc-500 italic">
              No classes
            </span>
          )}
        </div>

        {/* Attributes button */}
        <button
          type="button"
          onClick={handleToggleAttributes}
          className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 font-bold shrink-0 ml-1 ${
            openTarget === "__attributes__"
              ? "bg-indigo-600 border-indigo-400 text-white shadow"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <span>⚙️ Attributes</span>
          {attrsCount > 0 && (
            <span className="px-1 py-0.1 bg-indigo-950 border border-indigo-700/80 text-indigo-300 rounded-full text-[9px]">
              {attrsCount}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {openTarget && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 0 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 0 }}
            transition={{ duration: 0.1, ease: "easeInOut" }}
            className="w-full flex flex-col rounded-lg border border-indigo-500/60 bg-zinc-950 overflow-hidden shadow-xl"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-950/70 border-b border-indigo-900/60 select-none">
              <span className="text-[12px] font-mono font-bold text-indigo-200">
                {openTarget !== "__attributes__"
                  ? `SCSS: .${openTarget}`
                  : `Attributes <${nodeTag}> (JSON)`}
              </span>
              <ButtonUndoRedoScss />
              {openTarget !== "__attributes__" && (
                <ModalCustomStyles
                  currentClass={openTarget}
                  onApplySnippet={handleApplySnippet}
                />
              )}
              <div className="flex items-center gap-2">
                {openTarget !== "__attributes__" && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentClassCss}
                    className="text-[10px] font-mono text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition cursor-pointer"
                  >
                    ✕ Clear
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="text-[10px] font-mono font-bold text-white px-2.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 shadow transition cursor-pointer"
                >
                  ✓ Save / Close
                </button>
              </div>
            </div>

            <div className="h-[160px] w-full relative">
              <Editor
                key={openTarget}
                height="160px"
                theme="vs-dark"
                language={openTarget === "__attributes__" ? "json" : "scss"}
                value={currentText}
                onChange={(val) => {
                  const text = val || "";
                  setCurrentText(text);
                  currentTextRef.current = text;
                  isDirtyRef.current = true;
                }}
                onMount={handleEditorDidMount}
                options={{
                  readOnly: false,
                  minimap: { enabled: false },
                  fontSize: 12,
                  fontFamily: "var(--font-mono), monospace",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: "on",
                  tabSize: 2,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
