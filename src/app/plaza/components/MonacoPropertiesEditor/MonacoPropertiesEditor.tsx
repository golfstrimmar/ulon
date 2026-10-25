"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  extractClassSnippet,
  updateClassInGlobalScss,
} from "@/lib/scssCompiler";
import { motion, AnimatePresence } from "framer-motion";
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
  onAddClassToNode?: (className: string) => void;
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
  // onAddClassToNode,
}: MonacoPropertiesEditorProps) {
  const [openTarget, setOpenTarget] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState<string>("");
  const currentTextRef = useRef<string>("");
  currentTextRef.current = currentText;

  const isDirtyRef = useRef<boolean>(false);
  const [newClassInput, setNewClassInput] = useState<string>("");

  const globalScssRef = useRef<string>(globalScss);
  globalScssRef.current = globalScss;

  // ОПЕРАТИВНОЕ ОБНОВЛЕНИЕ: следит за globalScss и openTarget
  useEffect(() => {
    if (!openTarget) {
      setCurrentText("");
      currentTextRef.current = "";
      isDirtyRef.current = false;
      return;
    }

    // Если пользователь прямо сейчас в процессе набора — не сбиваем его
    if (isDirtyRef.current) return;

    if (openTarget === "__attributes__") {
      const formatted = JSON.stringify(attributesValue || {}, null, 2);
      if (formatted !== currentTextRef.current) {
        setCurrentText(formatted);
        currentTextRef.current = formatted;
      }
    } else {
      // Моментально вытягиваем свежий вариант из глобального SCSS
      const freshSnippet = extractClassSnippet(globalScss, openTarget);
      if (freshSnippet !== currentTextRef.current) {
        setCurrentText(freshSnippet);
        currentTextRef.current = freshSnippet;
      }
    }
  }, [globalScss, openTarget, attributesValue]);

  // Сохранение вызывается ТОЛЬКО по событию (blur, закрытие, Ctrl+S)
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

  // const handleAddNewClass = (e?: React.FormEvent) => {
  //   if (e) e.preventDefault();
  //   const clean = newClassInput.trim().replace(/^\./, "");
  //   if (!clean) return;

  //   if (openTarget) {
  //     saveCurrentOpenTarget(openTarget);
  //   }

  //   if (onAddClassToNode) {
  //     onAddClassToNode(clean);
  //   }

  //   // Если такой класс уже есть в globalScss — берем его, если нет — создаем заготовку
  //   const existing = extractClassSnippet(globalScssRef.current, clean);
  //   const template =
  //     existing !== `.${clean} {\n  \n}` ? existing : `.${clean} {\n  \n}`;

  //   setCurrentText(template);
  //   currentTextRef.current = template;
  //   isDirtyRef.current = true;
  //   setOpenTarget(clean);
  //   setNewClassInput("");
  // };

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

  // Слушаем потерю фокуса и Ctrl+S в Monaco
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editor.onDidBlurEditorText(() => {
      saveCurrentOpenTarget();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCurrentOpenTarget();
    });
  };

  const attrsCount = useMemo(() => {
    return Object.keys(attributesValue || {}).length;
  }, [attributesValue]);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-wrap justify-between items-center gap-1.5 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
        {/*-----Classes-----*/}
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
                  onClick={() => handleToggleClass(cls)}
                  title={`Редактировать SCSS для .${cls}`}
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
        {/*<form
          onSubmit={handleAddNewClass}
          className="flex items-center gap-1 ml-auto shrink-0"
        >
          <input
            type="text"
            value={newClassInput}
            onChange={(e) => setNewClassInput(e.target.value)}
            placeholder="+ класс"
            className="w-24 px-2 py-0.5 text-[11px] font-mono rounded bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!newClassInput.trim()}
            className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-300 border border-zinc-700 transition cursor-pointer disabled:opacity-40"
          >
            +
          </button>
        </form>*/}
        {/*-----Attributes----*/}
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
                  : `Атрибуты <${nodeTag}> (JSON)`}
              </span>

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
