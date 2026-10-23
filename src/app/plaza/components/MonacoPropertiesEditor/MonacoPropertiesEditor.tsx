"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { compileClassesCss } from "@/lib/cssCompiler";

interface MonacoPropertiesEditorProps {
  nodeClasses: string[];
  classesCss: Record<string, string>;
  inlineStyleValue: string;
  attributesValue?: Record<string, string>;
  onSaveClassCss: (className: string, css: string) => Promise<void> | void;
  onDeleteClassCss?: (className: string) => Promise<void> | void;
  onSaveFullCss?: (fullCss: string) => Promise<void> | void;
  onSaveInlineStyle: (style: string) => Promise<void> | void;
  onSaveAttributes?: (
    attributes: Record<string, string>,
  ) => Promise<void> | void;
  onAddClassToNode?: (className: string) => void;
}

/**
 * Преобразует инлайн-стиль в многострочный CSS для удобного редактирования
 */
function formatStyleToCss(styleStr: string): string {
  if (!styleStr || !styleStr.trim()) return "";
  return styleStr
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(";") ? s : s + ";"))
    .join("\n");
}

/**
 * Преобразует многострочный CSS обратно в строку style
 */
function cssToStyleString(css: string): string {
  return css
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

export function MonacoPropertiesEditor({
  nodeClasses = [],
  classesCss = {},
  inlineStyleValue = "",
  attributesValue = {},
  onSaveClassCss,
  onDeleteClassCss,
  onSaveFullCss,
  onSaveInlineStyle,
  onSaveAttributes,
  onAddClassToNode,
}: MonacoPropertiesEditorProps) {
  // openTarget:
  // null — никакой редактор не открыт
  // string (например "card") — открыт редактор свойств класса "card"
  // "__inline__" — открыт редактор инлайн-стиля
  // "__all_css__" — открыт финальный список свойств
  // "__attributes__" — открыт редактор JSON-атрибутов
  const [openTarget, setOpenTarget] = useState<string | null>(null);

  // Буфер текста для текущего открытого редактора
  const [currentText, setCurrentText] = useState<string>("");
  const currentTextRef = useRef<string>("");
  currentTextRef.current = currentText;

  // Инпут для быстрого добавления нового класса
  const [newClassInput, setNewClassInput] = useState<string>("");

  // Сохранение открытого таргета
  const saveCurrentOpenTarget = (targetToSave: string | null = openTarget) => {
    if (!targetToSave) return;

    if (targetToSave === "__inline__") {
      const inline = cssToStyleString(currentTextRef.current);
      onSaveInlineStyle(inline);
    } else if (targetToSave === "__attributes__") {
      try {
        const parsed = JSON.parse(currentTextRef.current || "{}");
        if (typeof parsed === "object" && parsed !== null && onSaveAttributes) {
          onSaveAttributes(parsed);
        }
      } catch (err) {
        console.warn("Invalid attributes JSON in Monaco editor:", err);
      }
    } else if (targetToSave === "__all_css__") {
      // Сохраняем напрямую в финальный список свойств
      if (onSaveFullCss) {
        onSaveFullCss(currentTextRef.current);
      }
    } else {
      // Конкретный класс: сохраняем (если пустой — handleSaveClassCss автоматически удалит его из финального списка)
      onSaveClassCss(targetToSave, currentTextRef.current);
    }
  };

  // Клик по плашке класса: переключаем открытие редактора именно этого класса
  const handleToggleClass = (cls: string) => {
    const clean = cls.trim().replace(/^\./, "");
    if (!clean) return;

    // Если этот класс уже открыт — сохраняем и закрываем
    if (openTarget === clean) {
      saveCurrentOpenTarget(clean);
      setOpenTarget(null);
      return;
    }

    // Если был открыт другой таргет — сохраняем его перед сменой
    if (openTarget) {
      saveCurrentOpenTarget(openTarget);
    }

    // Загружаем CSS строго для выбранного класса
    const classCss = classesCss[clean] || "";
    setCurrentText(classCss);
    currentTextRef.current = classCss;
    setOpenTarget(clean);
  };

  // Клик по специальным вкладкам (финальный список свойств, инлайн, атрибуты)
  const handleToggleSpecialTab = (
    tab: "__inline__" | "__all_css__" | "__attributes__",
  ) => {
    if (openTarget === tab) {
      saveCurrentOpenTarget(tab);
      setOpenTarget(null);
      return;
    }

    if (openTarget) {
      saveCurrentOpenTarget(openTarget);
    }

    if (tab === "__inline__") {
      const formatted = formatStyleToCss(inlineStyleValue || "");
      setCurrentText(formatted);
      currentTextRef.current = formatted;
    } else if (tab === "__attributes__") {
      const jsonStr = JSON.stringify(attributesValue || {}, null, 2);
      setCurrentText(jsonStr);
      currentTextRef.current = jsonStr;
    } else if (tab === "__all_css__") {
      const compiled = compileClassesCss(classesCss);
      setCurrentText(compiled || "/* Финальный список свойств пока пуст */");
      currentTextRef.current = compiled;
    }

    setOpenTarget(tab);
  };

  // Закрытие редактора с сохранением
  const handleCloseEditor = () => {
    saveCurrentOpenTarget();
    setOpenTarget(null);
  };

  // Добавление нового класса и сразу открытие его редактора
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

    const existing = classesCss[clean] || "";
    setCurrentText(existing);
    currentTextRef.current = existing;
    setOpenTarget(clean);
    setNewClassInput("");
  };

  // Удаление стилей для открытого класса (удаляет класс из финального списка)
  const handleDeleteCurrentClassCss = () => {
    if (!openTarget || openTarget.startsWith("__")) return;
    const targetToDelete = openTarget;
    setCurrentText("");
    currentTextRef.current = "";

    if (onDeleteClassCss) {
      onDeleteClassCss(targetToDelete);
    } else {
      onSaveClassCss(targetToDelete, "");
    }

    // Закрываем редактор этого класса, чтобы повторный blur не пересохранил его
    setOpenTarget(null);
  };

  // Blur сохраняет данные в текущий таргет
  const handleEditorDidMount: OnMount = (editor) => {
    editor.onDidBlurEditorText(() => {
      saveCurrentOpenTarget();
    });
  };

  // Проверка: если открытый класс был удален из ноды
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

  return (
    <div className="w-full flex flex-col gap-2">
      {/* 1. Ряд названий классов и быстрого добавления */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mr-1 shrink-0">
          Классы кирпичика:
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
                title={
                  isOpen
                    ? `Закрыть свойства .${cls}`
                    : `Нажмите, чтобы настроить CSS свойства для класса .${cls}`
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition cursor-pointer flex items-center gap-1.5 border ${
                  isOpen
                    ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow-[0_0_12px_rgba(99,102,241,0.5)] ring-2 ring-indigo-400/60"
                    : hasCss
                      ? "bg-zinc-850 border-emerald-500/70 text-emerald-300 hover:bg-zinc-800"
                      : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span>.{cls}</span>
                {hasCss && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    title="У класса уже есть свойства в финальном списке"
                  />
                )}
                <span className="text-[9px] opacity-70">
                  {isOpen ? "▴" : "▾"}
                </span>
              </button>
            );
          })
        ) : (
          <span className="text-[11px] font-mono text-zinc-500 italic">
            Нет классов
          </span>
        )}

        {/* Быстрое добавление класса */}
        <form
          onSubmit={handleAddNewClass}
          className="flex items-center gap-1 ml-auto shrink-0"
        >
          <input
            type="text"
            value={newClassInput}
            onChange={(e) => setNewClassInput(e.target.value)}
            placeholder="+ новый класс"
            className="w-28 px-2 py-0.5 text-[11px] font-mono rounded bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
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

      {/* 2. Дополнительные вкладки: Финальный список свойств, Инлайн style, Атрибуты */}
      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-zinc-400 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Кнопка открытия финального списка свойств */}
          <button
            type="button"
            onClick={() => handleToggleSpecialTab("__all_css__")}
            title="Открыть полный финальный список стилей всех классов для <head>"
            className={`px-2.5 py-1 rounded border transition cursor-pointer flex items-center gap-1.5 font-bold ${
              openTarget === "__all_css__"
                ? "bg-emerald-600 border-emerald-400 text-white shadow-sm"
                : "bg-zinc-900 border-zinc-800 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-850"
            }`}
          >
            <span>🎨 Финальный список свойств</span>
            {totalStyledClasses > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-950 border border-emerald-700/80 text-emerald-300 rounded-full text-[9px] font-bold">
                {totalStyledClasses}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleToggleSpecialTab("__inline__")}
            className={`px-2 py-0.5 rounded border transition cursor-pointer ${
              openTarget === "__inline__"
                ? "bg-indigo-600 border-indigo-400 text-white font-bold"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            Инлайн (style)
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
          {openTarget
            ? "Сохраняется в финальный список при потере фокуса"
            : "Нажмите на класс выше, чтобы настроить его свойства"}
        </span>
      </div>

      {/* 3. Выпадающий блок Monaco Editor под выбранным классом */}
      {openTarget && (
        <div className="w-full flex flex-col rounded-lg border border-indigo-500/60 bg-zinc-950 overflow-hidden shadow-xl animate-in fade-in duration-150">
          {/* Шапка открытого редактора */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-950/70 border-b border-indigo-900/60 select-none">
            <div className="flex items-center gap-2">
              {!openTarget.startsWith("__") ? (
                <>
                  <span className="text-[11px] font-mono text-zinc-300">
                    Свойства класса:
                  </span>
                  <code className="text-[12px] font-mono font-bold text-indigo-200 bg-indigo-900/90 px-2 py-0.5 rounded border border-indigo-600">
                    .{openTarget} &#123; ... &#125;
                  </code>
                  <span className="text-[10px] font-mono text-emerald-400 hidden md:inline">
                    (изменения сразу вносятся в финальный список свойств)
                  </span>
                </>
              ) : openTarget === "__all_css__" ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-emerald-300 font-bold">
                    Финальный список свойств (&lt;head&gt; iframe)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">
                    (изменения и удаления здесь обновляют свойства классов)
                  </span>
                </div>
              ) : openTarget === "__inline__" ? (
                <span className="text-[11px] font-mono text-indigo-200 font-bold">
                  Инлайн-стили тега (style="..." в теле документа)
                </span>
              ) : (
                <span className="text-[11px] font-mono text-indigo-200 font-bold">
                  Пользовательские HTML-атрибуты (JSON)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!openTarget.startsWith("__") &&
                Boolean(classesCss[openTarget]?.trim()) && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentClassCss}
                    title={`Удалить все свойства класса .${openTarget} из финального списка`}
                    className="text-[10px] font-mono text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition cursor-pointer"
                  >
                    ✕ Удалить свойства из финала
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

          {/* Monaco Editor: key={openTarget} гарантирует чистое состояние под выбранный класс */}
          <div className="h-[140px] w-full relative">
            <Editor
              key={openTarget}
              height="140px"
              theme="vs-dark"
              language={openTarget === "__attributes__" ? "json" : "css"}
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
