"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import ModalCustomStyles from "@/app/plaza/components/CanvasArea/components/ModalCustomStyles/ModalCustomStyles";

import {
  extractClassSnippet,
  updateClassInGlobalScss,
  updateNestedSnippetInClass,
} from "@/lib/scssCompiler";
import { extractExistingPseudoSelectors } from "@/app/plaza/components/CanvasArea/components/ModalCustomStyles/constants/pseudoLibrary";
import { motion, AnimatePresence } from "framer-motion";
import ButtonUndoRedoScss from "@/components/ButtonUndoRedoScss";

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
  nodeStyle?: string;
  globalScss: string;
  globalJs?: string;
  attributesValue?: Record<string, string>;
  onSaveGlobalScss: (nextScss: string) => Promise<void> | void;
  onSaveScriptJs?: (targetName: string, jsCode: string) => Promise<void>;
  onAddClassToNode?: (newCls: string) => Promise<void>;
  onSaveAttributes?: (
    attributes: Record<string, string>,
  ) => Promise<void> | void;
}

function getSnippetWithFallback(
  cls: string | null,
  scss: string,
  fallbackStyle?: string,
): string {
  if (!cls) return "";
  const extracted = extractClassSnippet(scss, cls);
  const isEmpty =
    !extracted ||
    extracted.trim() === `.${cls} {\n  \n}` ||
    extracted.trim() === `.${cls} {}` ||
    extracted.trim() === `.${cls} {\n}`;

  if (isEmpty && fallbackStyle && fallbackStyle.trim()) {
    const formatted = fallbackStyle
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `  ${s};`)
      .join("\n");
    if (formatted) {
      return `.${cls} {\n${formatted}\n}`;
    }
  }

  return extracted;
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
  nodeKey = "",
  nodeTag = "div",
  nodeClasses = [],
  nodeStyle = "",
  globalScss = "",
  attributesValue = {},
  onSaveGlobalScss,
  onSaveAttributes,
}: MonacoPropertiesEditorProps) {
  // Инициализируем сразу первым классом при монтировании
  const firstCls = nodeClasses[0] ?? null;
  const [openTarget, setOpenTarget] = useState<string | null>(firstCls);
  const [activeScope, setActiveScope] = useState<string>("base");
  const [currentText, setCurrentText] = useState<string>(() =>
    firstCls ? getSnippetWithFallback(firstCls, globalScss, nodeStyle) : "",
  );
  const currentTextRef = useRef<string>("");
  currentTextRef.current = currentText;

  const isDirtyRef = useRef<boolean>(false);

  const globalScssRef = useRef<string>(globalScss);
  globalScssRef.current = globalScss;

  const prevNodeKeyRef = useRef<string>(nodeKey);

  // Список существующих псевдоэлементов/классов внутри текущего класса
  const existingPseudos = useMemo(() => {
    if (!openTarget || openTarget === "__attributes__") return [];
    return extractExistingPseudoSelectors(currentText);
  }, [openTarget, currentText]);

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

  // 🔹 Сброс и авто-открытие первого класса при смене ноды
  useEffect(() => {
    if (prevNodeKeyRef.current !== nodeKey) {
      if (isDirtyRef.current && openTarget) {
        saveCurrentOpenTarget(openTarget);
      }
      prevNodeKeyRef.current = nodeKey;
      isDirtyRef.current = false;

      // Авто-открываем первый класс если есть
      setActiveScope("base");
      if (nodeClasses.length > 0) {
        const firstCls = nodeClasses[0];
        const snippet = getSnippetWithFallback(
          firstCls,
          globalScssRef.current,
          nodeStyle,
        );
        setCurrentText(snippet);
        currentTextRef.current = snippet;
        setOpenTarget(firstCls);
      } else {
        setOpenTarget(null);
        setCurrentText("");
        currentTextRef.current = "";
      }
    }
  }, [nodeKey]);

  // 🔹 Если текущий класс пропал — переключаемся на первый доступный
  useEffect(() => {
    if (openTarget && openTarget !== "__attributes__") {
      if (!nodeClasses.includes(openTarget)) {
        isDirtyRef.current = false;
        setActiveScope("base");
        if (nodeClasses.length > 0) {
          const fallback = nodeClasses[0];
          const snippet = getSnippetWithFallback(
            fallback,
            globalScssRef.current,
            nodeStyle,
          );
          setCurrentText(snippet);
          currentTextRef.current = snippet;
          setOpenTarget(fallback);
        } else {
          setOpenTarget(null);
          setCurrentText("");
          currentTextRef.current = "";
        }
      }
    }
  }, [nodeClasses, openTarget]);

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
      const freshSnippet = getSnippetWithFallback(
        openTarget,
        globalScss,
        nodeStyle,
      );
      if (freshSnippet !== currentTextRef.current) {
        setCurrentText(freshSnippet);
        currentTextRef.current = freshSnippet;
      }
    }
  }, [globalScss, openTarget, attributesValue, nodeStyle]);

  const handleToggleClass = (cls: string) => {
    const clean = cls.trim().replace(/^\./, "");
    if (!clean) return;

    setActiveScope("base");
    if (openTarget === clean) {
      saveCurrentOpenTarget(clean);
      setOpenTarget(null);
      return;
    }

    if (openTarget) {
      saveCurrentOpenTarget(openTarget);
    }

    const snippet = getSnippetWithFallback(
      clean,
      globalScssRef.current,
      nodeStyle,
    );
    setCurrentText(snippet);
    currentTextRef.current = snippet;
    isDirtyRef.current = false;
    setOpenTarget(clean);
  };

  const handleToggleAttributes = () => {
    setActiveScope("base");
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

  const cleanConflictingProperties = (
    existingCss: string,
    newSnippet: string,
  ): string => {
    const newPropertyNames: string[] = [];
    const propRegex = /([a-zA-Z0-9_-]+)\s*:/g;
    let match: RegExpExecArray | null;

    while ((match = propRegex.exec(newSnippet)) !== null) {
      newPropertyNames.push(match[1].toLowerCase());
    }

    if (newPropertyNames.includes("padding")) {
      newPropertyNames.push(
        "padding-top",
        "padding-right",
        "padding-bottom",
        "padding-left",
      );
    }

    if (newPropertyNames.includes("margin")) {
      newPropertyNames.push(
        "margin-top",
        "margin-right",
        "margin-bottom",
        "margin-left",
      );
    }

    if (newPropertyNames.some((p) => p.startsWith("padding-"))) {
      newPropertyNames.push("padding");
    }

    if (newPropertyNames.some((p) => p.startsWith("margin-"))) {
      newPropertyNames.push("margin");
    }

    if (newPropertyNames.includes("gap")) {
      newPropertyNames.push("row-gap", "column-gap");
    }

    if (
      newPropertyNames.includes("row-gap") ||
      newPropertyNames.includes("column-gap")
    ) {
      newPropertyNames.push("gap");
    }

    if (newSnippet.includes("display: grid")) {
      newPropertyNames.push("flex-direction", "flex-wrap");
    }

    if (newSnippet.includes("display: flex")) {
      newPropertyNames.push(
        "grid-template-columns",
        "grid-template-rows",
        "grid-auto-flow",
      );
    }

    let lines = existingCss.split("\n");

    lines = lines.filter((line) => {
      const trimmed = line.trim();
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
        if (newPropertyNames.includes(propName)) {
          return false;
        }
      }
      return true;
    });

    return lines.join("\n");
  };

  const handleApplySnippet = (snippetCss: string) => {
    if (!openTarget || openTarget === "__attributes__") return;

    let text = currentTextRef.current.trim();
    const trimmedSnippet = snippetCss.trim();

    // 1. Если snippetCss это целый класс .cls { ... } — заменяем полностью
    if (trimmedSnippet.startsWith(`.${openTarget}`)) {
      text = trimmedSnippet;
    }
    // 2. Если snippetCss это псевдо-селектор (&:before, &:after, &:hover, etc.) или медиа-запрос (@media ...)
    else if (
      trimmedSnippet.startsWith("&") ||
      trimmedSnippet.startsWith("@media")
    ) {
      let nestedSelector: string | null = null;
      if (trimmedSnippet.startsWith("&")) {
        const match = trimmedSnippet.match(/^(&[:a-zA-Z0-9_()-]+)/);
        nestedSelector = match ? match[1] : null;
      } else if (trimmedSnippet.startsWith("@media")) {
        const match = trimmedSnippet.match(/^(@media[^{]+)/);
        nestedSelector = match ? match[1].trim() : null;
      }

      if (
        !text ||
        text === `.${openTarget} {\n  \n}` ||
        text === `.${openTarget} {}`
      ) {
        text = `.${openTarget} {\n  ${trimmedSnippet.split("\n").join("\n  ")}\n}`;
      } else if (nestedSelector) {
        text = updateNestedSnippetInClass(text, nestedSelector, trimmedSnippet);
      } else {
        const lastBraceIndex = text.lastIndexOf("}");
        if (lastBraceIndex !== -1) {
          const before = text.slice(0, lastBraceIndex).trimEnd();
          text = `${before}\n\n  ${trimmedSnippet.split("\n").join("\n  ")}\n}`;
        } else {
          text = `${text}\n  ${trimmedSnippet}`;
        }
      }
    }
    // 3. Стандартный набор CSS свойств (например typography, position, color и т.д.)
    else {
      if (text) {
        text = cleanConflictingProperties(text, snippetCss);
      }

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
    }

    setCurrentText(text);
    currentTextRef.current = text;
    isDirtyRef.current = false;

    const preparedCode = ensureSelectorWrapper(openTarget, text);
    const nextScss = updateClassInGlobalScss(
      globalScssRef.current,
      openTarget,
      preparedCode,
    );
    globalScssRef.current = nextScss;

    onSaveGlobalScss(nextScss);
  };

  const attrsCount = useMemo(() => {
    return Object.keys(attributesValue || {}).length;
  }, [attributesValue]);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-wrap justify-between items-center gap-1.5 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono  tracking-wider text-zinc-400 font-semibold mr-1 shrink-0">
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

      {openTarget && (
        <div className="w-full flex flex-col rounded-lg border border-indigo-500/60 bg-zinc-950 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-950/70 border-b border-indigo-900/60 select-none">
            {/*{openTarget !== "__attributes__" && (*/}
            <ModalCustomStyles
              currentClass={openTarget}
              currentScssText={currentText}
              activeScope={activeScope}
              onScopeChange={setActiveScope}
              onApplySnippet={handleApplySnippet}
            />
            {/*)}*/}
            {/*<span className="text-[12px] font-mono font-bold text-indigo-200">
                {openTarget !== "__attributes__"
                  ? `SCSS: .${openTarget}`
                  : `Attributes <${nodeTag}> (JSON)`}
              </span>*/}
            <ButtonUndoRedoScss />

            <div className="flex items-center gap-2">
              {openTarget !== "__attributes__" && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentClassCss}
                  className="text-[10px] font-mono text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded bg-red-900/70 hover:bg-zinc-800/70 border border-zinc-700 transition cursor-pointer ml-4 whitespace-nowrap"
                >
                  ✕ Clear
                </button>
              )}
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
        </div>
      )}
    </div>
  );
}
