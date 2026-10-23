"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { compileClassesCss } from "@/lib/cssCompiler";

interface MonacoPropertiesEditorProps {
  nodeKey?: string;
  nodeTag?: string;
  nodeClasses: string[];
  classesCss: Record<string, string>;
  scriptsJs?: Record<string, string>;
  attributesValue?: Record<string, string>;
  onSaveClassCss: (className: string, css: string) => Promise<void> | void;
  onDeleteClassCss?: (className: string) => Promise<void> | void;
  onSaveFullCss?: (fullCss: string) => Promise<void> | void;
  onSaveScriptJs?: (targetName: string, jsCode: string) => Promise<void> | void;
  onDeleteScriptJs?: (targetName: string) => Promise<void> | void;
  onSaveFullJs?: (fullJs: string) => Promise<void> | void;
  onSaveAttributes?: (
    attributes: Record<string, string>,
  ) => Promise<void> | void;
  onAddClassToNode?: (className: string) => void;
}

export function MonacoPropertiesEditor({
  nodeKey = "",
  nodeTag = "div",
  nodeClasses = [],
  classesCss = {},
  scriptsJs = {},
  attributesValue = {},
  onSaveClassCss,
  onDeleteClassCss,
  onSaveFullCss,
  onSaveScriptJs,
  onDeleteScriptJs,
  onSaveFullJs,
  onSaveAttributes,
  onAddClassToNode,
}: MonacoPropertiesEditorProps) {
  const [openTarget, setOpenTarget] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<"css" | "js">("css");

  const [currentText, setCurrentText] = useState<string>("");
  const currentTextRef = useRef<string>("");
  currentTextRef.current = currentText;

  const [newClassInput, setNewClassInput] = useState<string>("");

  const saveCurrentOpenTarget = (
    targetToSave: string | null = openTarget,
    mode: "css" | "js" = activeMode,
  ) => {
    if (!targetToSave) return;

    if (targetToSave === "__attributes__") {
      try {
        const parsed = JSON.parse(currentTextRef.current || "{}");
        if (typeof parsed === "object" && parsed !== null && onSaveAttributes) {
          onSaveAttributes(parsed);
        }
      } catch (err) {
        console.warn("Invalid attributes JSON in Monaco editor:", err);
      }
    } else if (targetToSave === "__all_css__") {
      if (onSaveFullCss) {
        onSaveFullCss(currentTextRef.current);
      }
    } else if (targetToSave === "__all_js__") {
      if (onSaveFullJs) {
        onSaveFullJs(currentTextRef.current);
      }
    } else {
      if (mode === "js") {
        if (onSaveScriptJs) {
          onSaveScriptJs(targetToSave, currentTextRef.current);
        }
      } else {
        onSaveClassCss(targetToSave, currentTextRef.current);
      }
    }
  };

  const handleToggleClass = (cls: string, forceMode?: "css" | "js") => {
    const clean = cls.trim().replace(/^\./, "");
    if (!clean) return;

    const nextMode = forceMode || activeMode;

    if (openTarget === clean && activeMode === nextMode) {
      saveCurrentOpenTarget(clean, nextMode);
      setOpenTarget(null);
      return;
    }

    if (openTarget) {
      saveCurrentOpenTarget(openTarget, activeMode);
    }

    setActiveMode(nextMode);
    if (nextMode === "js") {
      const existingJs =
        scriptsJs[clean] ||
        `// JS скрипт для .${clean}\nconst el = document.querySelector('.${clean}');\nif (el) {\n  el.addEventListener('click', () => {\n    // Ваш код\n  });\n}`;
      setCurrentText(existingJs);
      currentTextRef.current = existingJs;
    } else {
      const classCss = classesCss[clean] || "";
      setCurrentText(classCss);
      currentTextRef.current = classCss;
    }

    setOpenTarget(clean);
  };

  // Вместо инлайн-стиля: открываем/создаем класс для данного элемента в итоговом CSS
  const handleOpenElementStyles = () => {
    const primaryClass =
      nodeClasses.length > 0
        ? nodeClasses[0]
        : `${nodeTag.toLowerCase().replace(/[^a-z0-9]/g, "")}-${nodeKey.slice(-5) || "el"}`;

    if (!nodeClasses.includes(primaryClass) && onAddClassToNode) {
      onAddClassToNode(primaryClass);
    }

    handleToggleClass(primaryClass, "css");
  };

  const handleToggleSpecialTab = (
    tab: "__all_css__" | "__all_js__" | "__attributes__",
  ) => {
    if (openTarget === tab) {
      saveCurrentOpenTarget(tab);
      setOpenTarget(null);
      return;
    }

    if (openTarget) {
      saveCurrentOpenTarget(openTarget);
    }

    if (tab === "__attributes__") {
      const jsonStr = JSON.stringify(attributesValue || {}, null, 2);
      setCurrentText(jsonStr);
      currentTextRef.current = jsonStr;
    } else if (tab === "__all_css__") {
      const compiled = compileClassesCss(classesCss);
      setCurrentText(compiled || "/* Финальный список свойств CSS пуст */");
      currentTextRef.current = compiled;
    } else if (tab === "__all_js__") {
      if (scriptsJs.__bundle__) {
        setCurrentText(scriptsJs.__bundle__);
        currentTextRef.current = scriptsJs.__bundle__;
      } else {
        const chunks = Object.keys(scriptsJs)
          .filter((k) => k !== "__bundle__" && scriptsJs[k]?.trim())
          .map((k) => `// [${k}]\n${scriptsJs[k]}`);
        const bundle =
          chunks.join("\n\n") || "// Итоговый бандл скриптов пока пуст";
        setCurrentText(bundle);
        currentTextRef.current = bundle;
      }
    }

    setOpenTarget(tab);
  };

  const handleCloseEditor = () => {
    saveCurrentOpenTarget();
    setOpenTarget(null);
  };

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

    setActiveMode("css");
    const existing = classesCss[clean] || "";
    setCurrentText(existing);
    currentTextRef.current = existing;
    setOpenTarget(clean);
    setNewClassInput("");
  };

  const handleDeleteCurrentTargetData = () => {
    if (!openTarget || openTarget.startsWith("__")) return;
    const targetToDelete = openTarget;
    setCurrentText("");
    currentTextRef.current = "";

    if (activeMode === "js") {
      if (onDeleteScriptJs) {
        onDeleteScriptJs(targetToDelete);
      }
    } else {
      if (onDeleteClassCss) {
        onDeleteClassCss(targetToDelete);
      } else {
        onSaveClassCss(targetToDelete, "");
      }
    }

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
      !openTarget.startsWith("__") &&
      nodeClasses.length > 0 &&
      !nodeClasses.includes(openTarget)
    ) {
      setOpenTarget(null);
    }
  }, [nodeClasses, openTarget]);

  const totalStyledClasses = useMemo(() => {
    return Object.keys(classesCss).filter((k) => classesCss[k]?.trim()).length;
  }, [classesCss]);

  const totalScripts = useMemo(() => {
    return Object.keys(scriptsJs).filter((k) => scriptsJs[k]?.trim()).length;
  }, [scriptsJs]);

  const currentLanguage = useMemo(() => {
    if (openTarget === "__attributes__") return "json";
    if (openTarget === "__all_js__" || activeMode === "js") return "javascript";
    return "css";
  }, [openTarget, activeMode]);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mr-1 shrink-0">
          Классы и скрипты:
        </span>

        {nodeClasses.length > 0 ? (
          nodeClasses.map((cls) => {
            const isOpenCss = openTarget === cls && activeMode === "css";
            const isOpenJs = openTarget === cls && activeMode === "js";
            const hasCss = Boolean(classesCss[cls]?.trim());
            const hasJs = Boolean(scriptsJs[cls]?.trim());

            return (
              <div
                key={cls}
                className="inline-flex items-center rounded-md border border-zinc-750 bg-zinc-900 overflow-hidden text-[11px] font-mono shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => handleToggleClass(cls, "css")}
                  title={`Настроить CSS в итоговом списке для .${cls}`}
                  className={`px-2 py-0.5 transition cursor-pointer flex items-center gap-1 ${
                    isOpenCss
                      ? "bg-indigo-600 text-white font-bold"
                      : hasCss
                        ? "text-emerald-400 hover:bg-zinc-800"
                        : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <span>.{cls}</span>
                  {hasCss && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleClass(cls, "js")}
                  title={`Настроить JS скрипт для .${cls}`}
                  className={`px-1.5 py-0.5 border-l border-zinc-750 transition cursor-pointer flex items-center gap-1 text-[10px] ${
                    isOpenJs
                      ? "bg-amber-600 text-white font-bold"
                      : hasJs
                        ? "text-amber-400 hover:bg-zinc-800"
                        : "text-zinc-500 hover:text-amber-300 hover:bg-zinc-800"
                  }`}
                >
                  <span>⚡ JS</span>
                  {hasJs && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              </div>
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
      </div>

      {/* Вкладки: Финал CSS, Финал JS, Стили элемента (в CSS класс), Атрибуты */}
      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-zinc-400 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleToggleSpecialTab("__all_css__")}
            title="Открыть полный финальный список CSS свойств для <head>"
            className={`px-2.5 py-1 rounded border transition cursor-pointer flex items-center gap-1.5 font-bold ${
              openTarget === "__all_css__"
                ? "bg-emerald-600 border-emerald-400 text-white shadow-sm"
                : "bg-zinc-900 border-zinc-800 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-850"
            }`}
          >
            <span>🎨 Финал CSS</span>
            {totalStyledClasses > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-950 border border-emerald-700/80 text-emerald-300 rounded-full text-[9px] font-bold">
                {totalStyledClasses}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleToggleSpecialTab("__all_js__")}
            title="Открыть итоговый JS-бандл"
            className={`px-2.5 py-1 rounded border transition cursor-pointer flex items-center gap-1.5 font-bold ${
              openTarget === "__all_js__"
                ? "bg-amber-600 border-amber-400 text-white shadow-sm"
                : "bg-zinc-900 border-zinc-800 text-amber-400 hover:text-amber-300 hover:bg-zinc-850"
            }`}
          >
            <span>⚡ Финал JS бандл</span>
            {totalScripts > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-950 border border-amber-700/80 text-amber-300 rounded-full text-[9px] font-bold">
                {totalScripts}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenElementStyles}
            title="Редактировать CSS стили этого элемента в итоговом списке (без инлайна)"
            className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            Стили элемента (в CSS)
          </button>

          <button
            type="button"
            onClick={() => handleToggleSpecialTab("__attributes__")}
            className={`px-2 py-0.5 rounded border transition cursor-pointer ${
              openTarget === "__attributes__"
                ? "bg-indigo-600 border-indigo-400 text-white font-bold"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            Атрибуты (JSON)
          </button>
        </div>

        <span className="text-zinc-500">
          Все стили попадают в итоговый CSS в &lt;head&gt;
        </span>
      </div>

      {openTarget && (
        <div className="w-full flex flex-col rounded-lg border border-indigo-500/60 bg-zinc-950 overflow-hidden shadow-xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-950/70 border-b border-indigo-900/60 select-none">
            <div className="flex items-center gap-2">
              {!openTarget.startsWith("__") ? (
                <>
                  <span className="text-[11px] font-mono text-zinc-300">
                    {activeMode === "js"
                      ? "⚡ JS скрипт:"
                      : "CSS в итоговом списке:"}
                  </span>
                  <code className="text-[12px] font-mono font-bold text-indigo-200 bg-indigo-900/90 px-2 py-0.5 rounded border border-indigo-600">
                    .{openTarget}{" "}
                    {activeMode === "js" ? "(JS логика)" : "{ ... }"}
                  </code>
                </>
              ) : openTarget === "__all_css__" ? (
                <span className="text-[11px] font-mono text-emerald-300 font-bold">
                  Финальный список CSS (&lt;head&gt; iframe)
                </span>
              ) : openTarget === "__all_js__" ? (
                <span className="text-[11px] font-mono text-amber-300 font-bold">
                  Итоговый JS бандл (выполняется перед &lt;/body&gt; в iframe)
                </span>
              ) : (
                <span className="text-[11px] font-mono text-indigo-200 font-bold">
                  Пользовательские HTML-атрибуты (JSON)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!openTarget.startsWith("__") && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentTargetData}
                  title="Очистить и удалить из итогового кода"
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

          <div className="h-[140px] w-full relative">
            <Editor
              key={`${openTarget}_${activeMode}`}
              height="140px"
              theme="vs-dark"
              language={currentLanguage}
              defaultValue={currentText}
              onChange={(val) => {
                const nextVal = val || "";
                setCurrentText(nextVal);
                currentTextRef.current = nextVal;
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
