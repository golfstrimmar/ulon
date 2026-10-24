"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { repairCss } from "@/lib/cssCompiler";

interface MonacoPropertiesEditorProps {
  nodeKey?: string;
  nodeTag?: string;
  nodeClasses: string[];
  classesCss: Record<string, string>;
  attributesValue?: Record<string, string>;
  onSaveClassCss: (className: string, css: string) => Promise<void> | void;
  onDeleteClassCss?: (className: string) => Promise<void> | void;
  onSaveAttributes?: (
    attributes: Record<string, string>,
  ) => Promise<void> | void;
  onAddClassToNode?: (className: string) => void;
}

export function MonacoPropertiesEditor({
  nodeTag = "div",
  nodeClasses = [],
  classesCss = {},
  attributesValue = {},
  onSaveClassCss,
  onDeleteClassCss,
  onSaveAttributes,
  onAddClassToNode,
}: MonacoPropertiesEditorProps) {
  const [openTarget, setOpenTarget] = useState<string | null>(null);

  const [currentText, setCurrentText] = useState<string>("");
  const currentTextRef = useRef<string>("");
  currentTextRef.current = currentText;

  const isDirtyRef = useRef<boolean>(false);
  const [newClassInput, setNewClassInput] = useState<string>("");

  // Синхронизация при внешних изменениях
  useEffect(() => {
    if (!openTarget) return;

    if (openTarget === "__attributes__") {
      const formatted = JSON.stringify(attributesValue || {}, null, 2);
      setCurrentText(formatted);
      currentTextRef.current = formatted;
      isDirtyRef.current = false;
    } else {
      const raw = classesCss[openTarget] || "";
      const cleaned = repairCss(openTarget, raw);
      setCurrentText(cleaned);
      currentTextRef.current = cleaned;
      isDirtyRef.current = false;
    }
  }, [classesCss, attributesValue, openTarget]);

  // Сохранение
  const saveCurrentOpenTarget = (targetToSave: string | null = openTarget) => {
    if (!targetToSave || !isDirtyRef.current) return;

    if (targetToSave === "__attributes__") {
      try {
        const parsed = JSON.parse(currentTextRef.current || "{}");
        if (typeof parsed === "object" && parsed !== null && onSaveAttributes) {
          onSaveAttributes(parsed);
        }
      } catch (err) {
        console.warn("Invalid attributes JSON in Monaco editor:", err);
      }
    } else {
      // Сохраняем честный CSS как есть
      onSaveClassCss(targetToSave, currentTextRef.current.trim());
    }

    isDirtyRef.current = false;
  };

  // Клик по кнопке класса
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

    const raw = classesCss[clean] || "";
    const cleanCss = repairCss(clean, raw);

    setCurrentText(cleanCss);
    currentTextRef.current = cleanCss;
    isDirtyRef.current = false;
    setOpenTarget(clean);
  };

  // Клик по атрибутам
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

  // Добавление нового класса
  const handleAddNewClass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newClassInput.trim().replace(/^\./, "");
    if (!clean) return;

    if (openTarget) {
      saveCurrentOpenTarget(openTarget);
    }

    if (onAddClassToNode) {
      onAddClassToNode(clean);
    }

    const template = `.${clean} {\n  \n}`;
    setCurrentText(template);
    currentTextRef.current = template;
    isDirtyRef.current = false;
    setOpenTarget(clean);
    setNewClassInput("");
  };

  const handleDeleteCurrentClassCss = () => {
    if (!openTarget || openTarget === "__attributes__") return;
    const targetToDelete = openTarget;
    setCurrentText("");
    currentTextRef.current = "";
    isDirtyRef.current = false;

    if (onDeleteClassCss) {
      onDeleteClassCss(targetToDelete);
    } else {
      onSaveClassCss(targetToDelete, "");
    }

    setOpenTarget(null);
  };

  const handleCloseEditor = () => {
    saveCurrentOpenTarget();
    setOpenTarget(null);
  };

  const handleEditorDidMount: OnMount = (editor) => {
    editor.onDidBlurEditorText(() => {
      saveCurrentOpenTarget();
    });
  };

  useEffect(() => {
    if (
      openTarget &&
      openTarget !== "__attributes__" &&
      nodeClasses.length > 0 &&
      !nodeClasses.includes(openTarget)
    ) {
      setOpenTarget(null);
    }
  }, [nodeClasses, openTarget]);

  const attrsCount = useMemo(() => {
    return Object.keys(attributesValue || {}).length;
  }, [attributesValue]);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Список классов */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mr-1 shrink-0">
          Классы:
        </span>

        {nodeClasses.length > 0 ? (
          nodeClasses.map((cls) => {
            const isOpen = openTarget === cls;
            const hasCss = Boolean(classesCss[cls]?.trim());

            return (
              <button
                key={cls}
                type="button"
                onClick={() => handleToggleClass(cls)}
                title={`Редактировать CSS для .${cls}`}
                className={`px-2 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 ${
                  isOpen
                    ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow"
                    : hasCss
                      ? "bg-zinc-900 border-zinc-700 text-emerald-400 hover:bg-zinc-800"
                      : "bg-zinc-900 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <span>.{cls}</span>
                {hasCss && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })
        ) : (
          <span className="text-[11px] font-mono text-zinc-500 italic">
            Нет классов
          </span>
        )}

        <form
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
        </form>

        <button
          type="button"
          onClick={handleToggleAttributes}
          className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 font-bold shrink-0 ml-1 ${
            openTarget === "__attributes__"
              ? "bg-indigo-600 border-indigo-400 text-white shadow"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <span>⚙️ Атрибуты</span>
          {attrsCount > 0 && (
            <span className="px-1 py-0.1 bg-indigo-950 border border-indigo-700/80 text-indigo-300 rounded-full text-[9px]">
              {attrsCount}
            </span>
          )}
        </button>
      </div>

      {/* Окно Monaco */}
      {openTarget && (
        <div className="w-full flex flex-col rounded-lg border border-indigo-500/60 bg-zinc-950 overflow-hidden shadow-xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-950/70 border-b border-indigo-900/60 select-none">
            <span className="text-[12px] font-mono font-bold text-indigo-200">
              {openTarget !== "__attributes__"
                ? `CSS для .${openTarget}`
                : `Атрибуты <${nodeTag}> (JSON)`}
            </span>

            <div className="flex items-center gap-2">
              {openTarget !== "__attributes__" && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentClassCss}
                  className="text-[10px] font-mono text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition cursor-pointer"
                >
                  ✕ Очистить
                </button>
              )}

              <button
                type="button"
                onClick={handleCloseEditor}
                className="text-[10px] font-mono font-bold text-white px-2.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 shadow transition cursor-pointer"
              >
                ✓ Сохранить / Закрыть
              </button>
            </div>
          </div>

          <div className="h-[160px] w-full relative">
            <Editor
              key={openTarget}
              height="160px"
              theme="vs-dark"
              language={openTarget === "__attributes__" ? "json" : "css"}
              value={currentText}
              onChange={(val) => {
                const nextVal = val || "";
                setCurrentText(nextVal);
                currentTextRef.current = nextVal;
                isDirtyRef.current = true;
              }}
              onMount={handleEditorDidMount}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "var(--font-mono), monospace",
                lineNumbers: "on",
                lineDecorationsWidth: 6,
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: "on",
                tabSize: 2,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
