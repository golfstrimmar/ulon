"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { OnMount } from "@monaco-editor/react";
import { updateClassInGlobalScss } from "@/lib/scssCompiler";
import {
  getSnippetWithFallback,
  ensureSelectorWrapper,
  applySnippetToClassCss,
} from "./propertiesEditorModel";

interface UseMonacoPropertiesEditorOptions {
  nodeKey?: string;
  nodeClasses: string[];
  nodeStyle?: string;
  globalScss: string;
  attributesValue?: Record<string, string>;
  onSaveGlobalScss: (nextScss: string) => Promise<void> | void;
  onClearNodeStyle?: () => Promise<void> | void;
  onSaveAttributes?: (
    attributes: Record<string, string>,
  ) => Promise<void> | void;
}

export function useMonacoPropertiesEditor({
  nodeKey = "",
  nodeClasses = [],
  nodeStyle = "",
  globalScss = "",
  attributesValue = {},
  onSaveGlobalScss,
  onClearNodeStyle,
  onSaveAttributes,
}: UseMonacoPropertiesEditorOptions) {
  const getFallbackForTarget = useCallback(
    (target: string | null) => {
      if (!target || !nodeStyle || !nodeStyle.trim()) return undefined;
      // fallbackStyle применим ТОЛЬКО к первому (базовому) классу ноды
      return target === nodeClasses[0] ? nodeStyle : undefined;
    },
    [nodeStyle, nodeClasses],
  );

  const firstCls = nodeClasses[0] ?? null;
  const [openTarget, setOpenTarget] = useState<string | null>(firstCls);
  const [activeScope, setActiveScope] = useState<string>("base");
  const [currentText, setCurrentText] = useState<string>(() =>
    firstCls
      ? getSnippetWithFallback(
          firstCls,
          globalScss,
          firstCls === nodeClasses[0] ? nodeStyle : undefined,
        )
      : "",
  );

  const currentTextRef = useRef<string>("");
  currentTextRef.current = currentText;

  const isDirtyRef = useRef<boolean>(false);
  const globalScssRef = useRef<string>(globalScss);
  globalScssRef.current = globalScss;

  const prevNodeKeyRef = useRef<string>(nodeKey);

  const saveCurrentOpenTarget = useCallback(
    (targetToSave: string | null = openTarget) => {
      if (!targetToSave || !isDirtyRef.current) return;

      if (targetToSave === "__attributes__") {
        try {
          const parsed = JSON.parse(currentTextRef.current || "{}");
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            onSaveAttributes
          ) {
            onSaveAttributes(parsed);
          }
        } catch (err) {
          console.warn(
            "[useMonacoPropertiesEditor] Invalid JSON attributes:",
            err,
          );
        }
      } else {
        const preparedCode = ensureSelectorWrapper(
          targetToSave,
          currentTextRef.current,
        );
        let nextScss = updateClassInGlobalScss(
          globalScssRef.current,
          targetToSave,
          preparedCode,
        );

        // Если у ноды был инлайн nodeStyle, переносим стили базового класса в SCSS (если их там нет) и очищаем style
        if (nodeStyle && nodeStyle.trim() && onClearNodeStyle) {
          const baseCls = nodeClasses[0];
          if (
            baseCls &&
            baseCls !== targetToSave &&
            !nextScss.includes(`.${baseCls}`)
          ) {
            const baseSnippet = getSnippetWithFallback(
              baseCls,
              nextScss,
              nodeStyle,
            );
            if (baseSnippet) {
              nextScss = updateClassInGlobalScss(
                nextScss,
                baseCls,
                ensureSelectorWrapper(baseCls, baseSnippet),
              );
            }
          }
          onClearNodeStyle();
        }

        globalScssRef.current = nextScss;
        onSaveGlobalScss(nextScss);
      }

      isDirtyRef.current = false;
    },
    [
      openTarget,
      nodeStyle,
      nodeClasses,
      onClearNodeStyle,
      onSaveAttributes,
      onSaveGlobalScss,
    ],
  );

  // Reset and auto-open first class on active node change
  useEffect(() => {
    if (prevNodeKeyRef.current !== nodeKey) {
      if (isDirtyRef.current && openTarget) {
        saveCurrentOpenTarget(openTarget);
      }
      prevNodeKeyRef.current = nodeKey;
      isDirtyRef.current = false;

      setActiveScope("base");
      if (nodeClasses.length > 0) {
        const fallback = nodeClasses[0];
        const snippet = getSnippetWithFallback(
          fallback,
          globalScssRef.current,
          getFallbackForTarget(fallback),
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
  }, [
    nodeKey,
    nodeClasses,
    nodeStyle,
    openTarget,
    saveCurrentOpenTarget,
    getFallbackForTarget,
  ]);

  // Fallback to first available class if currently opened class was deleted
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
            getFallbackForTarget(fallback),
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
  }, [nodeClasses, openTarget, nodeStyle, getFallbackForTarget]);

  // Sync with external SCSS or attribute updates when editor is not dirty
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
        getFallbackForTarget(openTarget),
      );
      if (freshSnippet !== currentTextRef.current) {
        setCurrentText(freshSnippet);
        currentTextRef.current = freshSnippet;
      }
    }
  }, [
    globalScss,
    openTarget,
    attributesValue,
    nodeStyle,
    getFallbackForTarget,
  ]);

  const handleToggleClass = useCallback(
    (cls: string) => {
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
        getFallbackForTarget(clean),
      );
      setCurrentText(snippet);
      currentTextRef.current = snippet;
      isDirtyRef.current = false;
      setOpenTarget(clean);
    },
    [openTarget, getFallbackForTarget, saveCurrentOpenTarget],
  );

  const handleToggleAttributes = useCallback(() => {
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
  }, [openTarget, attributesValue, saveCurrentOpenTarget]);

  const handleDeleteCurrentClassCss = useCallback(() => {
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
  }, [openTarget, onSaveGlobalScss]);

  const handleApplySnippet = useCallback(
    (snippetCss: string) => {
      if (!openTarget || openTarget === "__attributes__") return;

      const nextText = applySnippetToClassCss(
        openTarget,
        currentTextRef.current,
        snippetCss,
      );

      setCurrentText(nextText);
      currentTextRef.current = nextText;
      isDirtyRef.current = false;

      const preparedCode = ensureSelectorWrapper(openTarget, nextText);
      const nextScss = updateClassInGlobalScss(
        globalScssRef.current,
        openTarget,
        preparedCode,
      );
      globalScssRef.current = nextScss;
      onSaveGlobalScss(nextScss);
    },
    [openTarget, onSaveGlobalScss],
  );

  const handleTextChange = useCallback((val?: string) => {
    const text = val || "";
    setCurrentText(text);
    currentTextRef.current = text;
    isDirtyRef.current = true;
  }, []);

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco) => {
      editor.onDidBlurEditorText(() => {
        saveCurrentOpenTarget();
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        saveCurrentOpenTarget();
      });
    },
    [saveCurrentOpenTarget],
  );

  const attrsCount = useMemo(() => {
    return Object.keys(attributesValue || {}).length;
  }, [attributesValue]);

  return {
    openTarget,
    activeScope,
    setActiveScope,
    currentText,
    attrsCount,
    handleToggleClass,
    handleToggleAttributes,
    handleDeleteCurrentClassCss,
    handleApplySnippet,
    handleTextChange,
    handleEditorDidMount,
    saveCurrentOpenTarget,
  };
}
