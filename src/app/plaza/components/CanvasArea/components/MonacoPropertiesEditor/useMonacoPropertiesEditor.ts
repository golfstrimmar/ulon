"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { OnMount } from "@monaco-editor/react";
import {
  extractClassSnippet,
  updateClassInGlobalScss,
} from "@/lib/scssCompiler";
import {
  getSnippetWithFallback,
  buildAllClassesSnippet,
  updateGlobalScssFromMultiClass,
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

export type EditorMode = "styles" | "attributes";

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
  // Режим редактора: все стили ноды (styles) или атрибуты (attributes)
  const [mode, setMode] = useState<EditorMode>("styles");

  // Активный класс для визуального редактирования в модалке ModalCustomStyles (открывается сразу на первом классе)
  const firstCls = nodeClasses[0]
    ? nodeClasses[0].trim().replace(/^\./, "")
    : null;
  const [activeModalClass, setActiveModalClass] = useState<string | null>(
    firstCls,
  );
  const [isCustomStylesOpen, setIsCustomStylesOpen] = useState<boolean>(
    Boolean(firstCls),
  );
  const [activeScope, setActiveScope] = useState<string>("base");
  const userManuallyClosedRef = useRef<boolean>(false);

  const getFallbackForTarget = useCallback(
    (target: string | null) => {
      if (!target || !nodeStyle || !nodeStyle.trim()) return undefined;
      return target === nodeClasses[0] ? nodeStyle : undefined;
    },
    [nodeStyle, nodeClasses],
  );

  // Текст в Monaco (по умолчанию — все классы ноды разом, как во вкладке Styles браузера)
  const [currentText, setCurrentText] = useState<string>(() =>
    buildAllClassesSnippet(nodeClasses, globalScss, nodeStyle),
  );

  const currentTextRef = useRef<string>("");
  currentTextRef.current = currentText;

  const isDirtyRef = useRef<boolean>(false);
  const globalScssRef = useRef<string>(globalScss);
  globalScssRef.current = globalScss;

  const prevNodeKeyRef = useRef<string>(nodeKey);

  // 🔹 Сохранение текущего текста редактора в зависимости от режима
  const saveCurrentText = useCallback(() => {
    if (!isDirtyRef.current) return;

    if (mode === "attributes") {
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
      // mode === "styles": сохраняем все отредактированные классы в globalScss
      const nextScss = updateGlobalScssFromMultiClass(
        globalScssRef.current,
        currentTextRef.current,
        nodeClasses,
      );

      if (nodeStyle && nodeStyle.trim() && onClearNodeStyle) {
        onClearNodeStyle();
      }

      globalScssRef.current = nextScss;
      onSaveGlobalScss(nextScss);
    }

    isDirtyRef.current = false;
  }, [
    mode,
    nodeClasses,
    nodeStyle,
    onClearNodeStyle,
    onSaveAttributes,
    onSaveGlobalScss,
  ]);

  // Смена ноды: сбрасываем состояние и загружаем все классы новой ноды
  useEffect(() => {
    if (prevNodeKeyRef.current !== nodeKey) {
      if (isDirtyRef.current) {
        saveCurrentText();
      }
      prevNodeKeyRef.current = nodeKey;
      isDirtyRef.current = false;

      userManuallyClosedRef.current = false;
      const newFirstCls = nodeClasses[0]
        ? nodeClasses[0].trim().replace(/^\./, "")
        : null;
      setActiveModalClass(newFirstCls);
      setIsCustomStylesOpen(Boolean(newFirstCls));
      setActiveScope("base");

      if (mode === "styles") {
        const text = buildAllClassesSnippet(
          nodeClasses,
          globalScssRef.current,
          getFallbackForTarget(nodeClasses[0]),
        );
        setCurrentText(text);
        currentTextRef.current = text;
      } else {
        const jsonStr = JSON.stringify(attributesValue || {}, null, 2);
        setCurrentText(jsonStr);
        currentTextRef.current = jsonStr;
      }
    }
  }, [
    nodeKey,
    nodeClasses,
    mode,
    attributesValue,
    saveCurrentText,
    getFallbackForTarget,
  ]);

  // Синхронизация с внешними обновлениями SCSS/атрибутов, когда Monaco не редактируется пользователем
  useEffect(() => {
    if (isDirtyRef.current) return;

    if (mode === "attributes") {
      const formatted = JSON.stringify(attributesValue || {}, null, 2);
      if (formatted !== currentTextRef.current) {
        setCurrentText(formatted);
        currentTextRef.current = formatted;
      }
    } else {
      const freshText = buildAllClassesSnippet(
        nodeClasses,
        globalScss,
        getFallbackForTarget(nodeClasses[0]),
      );
      if (freshText !== currentTextRef.current) {
        setCurrentText(freshText);
        currentTextRef.current = freshText;
      }
    }
  }, [globalScss, mode, nodeClasses, attributesValue, getFallbackForTarget]);

  // Автоматически открываем первый класс, если классы появились, а модалка еще не была вручную закрыта
  useEffect(() => {
    if (
      nodeClasses.length > 0 &&
      !activeModalClass &&
      !userManuallyClosedRef.current
    ) {
      const first = nodeClasses[0].trim().replace(/^\./, "");
      if (first) {
        setActiveModalClass(first);
        setIsCustomStylesOpen(true);
      }
    }
  }, [nodeClasses, activeModalClass]);

  // Клик по кнопке класса — открывает/переключает модалку кастомизации для этого класса
  const handleClassButtonClick = useCallback(
    (cls: string) => {
      const clean = cls.trim().replace(/^\./, "");
      if (!clean) return;

      // Если нажали на уже активный класс — выключаем его
      if (activeModalClass === clean) {
        if (isCustomStylesOpen) {
          userManuallyClosedRef.current = true;
          setIsCustomStylesOpen(false);
          setActiveModalClass(null);
        } else {
          userManuallyClosedRef.current = false;
          setIsCustomStylesOpen(true);
        }
        return;
      }

      // Открываем модалку для нового выбранного класса
      userManuallyClosedRef.current = false;
      setActiveModalClass(clean);
      setIsCustomStylesOpen(true);
      setActiveScope("base");
    },
    [activeModalClass, isCustomStylesOpen],
  );

  // Переключение во вкладку Styles (все классы)
  const handleShowStylesTab = useCallback(() => {
    if (mode === "styles") return;
    if (isDirtyRef.current) {
      saveCurrentText();
    }
    setMode("styles");
    isDirtyRef.current = false;
    const freshText = buildAllClassesSnippet(
      nodeClasses,
      globalScssRef.current,
      getFallbackForTarget(nodeClasses[0]),
    );
    setCurrentText(freshText);
    currentTextRef.current = freshText;
  }, [mode, nodeClasses, saveCurrentText, getFallbackForTarget]);

  // Закрытие модалки кастомных стилей и сброс активного класса
  const handleCloseCustomStyles = useCallback(() => {
    userManuallyClosedRef.current = true;
    setIsCustomStylesOpen(false);
    setActiveModalClass(null);
  }, []);

  // Переключение во вкладку Attributes
  const handleToggleAttributes = useCallback(() => {
    if (mode === "attributes") {
      handleShowStylesTab();
      return;
    }

    if (isDirtyRef.current) {
      saveCurrentText();
    }

    setMode("attributes");
    setActiveModalClass(null);
    setIsCustomStylesOpen(false);
    isDirtyRef.current = false;

    const jsonStr = JSON.stringify(attributesValue || {}, null, 2);
    setCurrentText(jsonStr);
    currentTextRef.current = jsonStr;
  }, [mode, attributesValue, handleShowStylesTab, saveCurrentText]);

  // Очистка CSS конкретного класса
  const handleDeleteClassCss = useCallback(
    (targetClass: string) => {
      const clean = targetClass.trim().replace(/^\./, "");
      if (!clean) return;

      const nextScss = updateClassInGlobalScss(
        globalScssRef.current,
        clean,
        "",
      );
      globalScssRef.current = nextScss;
      onSaveGlobalScss(nextScss);

      if (mode === "styles") {
        const freshText = buildAllClassesSnippet(
          nodeClasses,
          nextScss,
          getFallbackForTarget(nodeClasses[0]),
        );
        setCurrentText(freshText);
        currentTextRef.current = freshText;
        isDirtyRef.current = false;
      }
    },
    [mode, nodeClasses, onSaveGlobalScss, getFallbackForTarget],
  );

  // 🔹 Применение сниппета из ModalCustomStyles к выбранному классу
  const handleApplySnippetForClass = useCallback(
    (targetClass: string, snippetCss: string) => {
      const clean = targetClass.trim().replace(/^\./, "");
      if (!clean) return;

      const currentClassCode = extractClassSnippet(
        globalScssRef.current,
        clean,
      );

      const updatedClassCode = applySnippetToClassCss(
        clean,
        currentClassCode,
        snippetCss,
      );

      const preparedCode = ensureSelectorWrapper(clean, updatedClassCode);
      const nextScss = updateClassInGlobalScss(
        globalScssRef.current,
        clean,
        preparedCode,
      );

      globalScssRef.current = nextScss;
      onSaveGlobalScss(nextScss);

      // Обновляем отображение всех классов в Monaco
      if (mode === "styles") {
        const freshText = buildAllClassesSnippet(
          nodeClasses,
          nextScss,
          getFallbackForTarget(nodeClasses[0]),
        );
        setCurrentText(freshText);
        currentTextRef.current = freshText;
        isDirtyRef.current = false;
      }
    },
    [mode, nodeClasses, onSaveGlobalScss, getFallbackForTarget],
  );

  // Изменение текста пользователем в Monaco (ручной ввод)
  const handleTextChange = useCallback((val?: string) => {
    const text = val || "";
    setCurrentText(text);
    currentTextRef.current = text;
    isDirtyRef.current = true;
  }, []);

  // Монтирование редактора (сохранение по blur и Ctrl+S)
  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco) => {
      editor.onDidBlurEditorText(() => {
        saveCurrentText();
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        saveCurrentText();
      });
    },
    [saveCurrentText],
  );

  const attrsCount = useMemo(() => {
    return Object.keys(attributesValue || {}).length;
  }, [attributesValue]);

  return {
    mode,
    activeModalClass,
    isCustomStylesOpen,
    activeScope,
    currentText,
    attrsCount,
    setIsCustomStylesOpen,
    setActiveScope,
    handleClassButtonClick,
    handleCloseCustomStyles,
    handleShowStylesTab,
    handleToggleAttributes,
    handleDeleteClassCss,
    handleApplySnippetForClass,
    handleTextChange,
    handleEditorDidMount,
    saveCurrentText,
  };
}
