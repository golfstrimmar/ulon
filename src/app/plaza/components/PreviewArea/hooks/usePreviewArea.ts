"use client";

import { useState, useRef, useEffect } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { getHtmlJson, getClassesCss } from "@/lib/htmlStorage";
import {
  DB_KEY,
  renderTree,
  extractFontFamilies,
  buildDocument,
  loadPreviewSettings,
  addFont,
  removeFont,
  toggleDefaultFont,
} from "@/app/plaza/components/PreviewArea/lib/previewModel";

export function usePreviewArea() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentBodyHtmlRef = useRef<string>("");

  // Состояние отображения
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isFontsPanelOpen, setIsFontsPanelOpen] = useState<boolean>(false);
  const [newFontInput, setNewFontInput] = useState<string>("");

  // Данные документа
  const [fontEntries, setFontEntries] = useState<string[]>([]);
  const [defaultFont, setDefaultFont] = useState<string>("");

  const [classesCss, setClassesCss] = useState<Record<string, string>>({});
  const classesCssRef = useRef<Record<string, string>>({});
  classesCssRef.current = classesCss;

  const [scriptsJs, setScriptsJs] = useState<Record<string, string>>({});
  const scriptsJsRef = useRef<Record<string, string>>({});
  scriptsJsRef.current = scriptsJs;

  // Вспомогательная функция обновления документа в iframe (из памяти)
  const updatePreviewDoc = (
    bodyHtml: string,
    fonts = fontEntries,
    defFont = defaultFont,
    css = classesCssRef.current,
    scripts = scriptsJsRef.current,
  ) => {
    currentBodyHtmlRef.current = bodyHtml;
    setIsEmpty(!bodyHtml.trim());
    setSrcDoc(
      buildDocument({
        bodyHtml,
        fontEntries: fonts,
        defaultFont: defFont,
        classesCss: css,
        scriptsJs: scripts,
      }),
    );
  };

  /* ==========================================================================
     1. ПЕРВОНАЧАЛЬНАЯ ЗАГРУЗКА И РЕНДЕР ПРИ МОНТИРОВАНИИ (Один раз при старте)
     ========================================================================== */
  useEffect(() => {
    async function initPreview() {
      // 1. Читаем шрифты и скрипты из localStorage
      const settings = loadPreviewSettings();
      setFontEntries(settings.fonts);
      setDefaultFont(settings.defaultFont);
      setClassesCss(settings.classesCss);
      classesCssRef.current = settings.classesCss;
      setScriptsJs(settings.scriptsJs);
      scriptsJsRef.current = settings.scriptsJs;

      // 2. Параллельно забираем из IndexedDB дерево разметки и стили классов
      try {
        const [rawTree, dbStyles] = await Promise.all([
          getHtmlJson(DB_KEY),
          getClassesCss().catch(() => null),
        ]);

        if (dbStyles && typeof dbStyles === "object") {
          setClassesCss(dbStyles);
          classesCssRef.current = dbStyles;
        }

        // 3. Формируем HTML дерева разметки
        let initialHtml = "";
        if (rawTree) {
          const nodes: HtmlNode[] = Array.isArray(rawTree)
            ? rawTree
            : [rawTree];
          if (nodes.length > 0) {
            initialHtml = renderTree(nodes);
          }
        }

        // 4. Первичный рендеринг собранного документа!
        currentBodyHtmlRef.current = initialHtml;
        setIsEmpty(!initialHtml.trim());
        setSrcDoc(
          buildDocument({
            bodyHtml: initialHtml,
            fontEntries: settings.fonts,
            defaultFont: settings.defaultFont,
            classesCss: dbStyles || settings.classesCss,
            scriptsJs: settings.scriptsJs,
          }),
        );
      } catch (err) {
        console.error("[usePreviewArea] Initial mount load error:", err);
      }
    }

    initPreview();
  }, []); // <--- Ровно один раз при загрузке страницы!

  /* ==========================================================================
     2. РЕАКЦИЯ НА СОБЫТИЯ ШИНЫ (Автообновление в реальном времени)
     ========================================================================== */

  // Изменение дерева в холсте
  useEffect(() => {
    const handleTreeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<HtmlNode[]>;
      const nodes = customEvent.detail;
      const html = nodes && nodes.length > 0 ? renderTree(nodes) : "";
      updatePreviewDoc(html);
    };

    window.addEventListener("plaza-tree-updated", handleTreeUpdate);
    return () =>
      window.removeEventListener("plaza-tree-updated", handleTreeUpdate);
  }, [fontEntries, defaultFont]);

  // Изменение стилей CSS
  useEffect(() => {
    const handleStylesUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      const nextStyles = customEvent.detail || {};
      setClassesCss(nextStyles);
      classesCssRef.current = nextStyles;
      updatePreviewDoc(
        currentBodyHtmlRef.current,
        fontEntries,
        defaultFont,
        nextStyles,
      );
    };

    window.addEventListener("plaza-styles-updated", handleStylesUpdate);
    return () =>
      window.removeEventListener("plaza-styles-updated", handleStylesUpdate);
  }, [fontEntries, defaultFont]);

  // Изменение скриптов JS
  useEffect(() => {
    const handleScriptsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      const nextScripts = customEvent.detail || {};
      setScriptsJs(nextScripts);
      scriptsJsRef.current = nextScripts;
      updatePreviewDoc(
        currentBodyHtmlRef.current,
        fontEntries,
        defaultFont,
        classesCssRef.current,
        nextScripts,
      );
    };

    window.addEventListener("plaza-scripts-updated", handleScriptsUpdate);
    return () =>
      window.removeEventListener("plaza-scripts-updated", handleScriptsUpdate);
  }, [fontEntries, defaultFont]);

  /* ==========================================================================
     3. ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ СО ШРИФТАМИ (Без похода в базу, сразу в память)
     ========================================================================== */

  const handleAddFont = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFontInput.trim()) return;

    const result = addFont(fontEntries, newFontInput, defaultFont);
    setFontEntries(result.fonts);
    setDefaultFont(result.defaultFont);
    setNewFontInput("");
    updatePreviewDoc(
      currentBodyHtmlRef.current,
      result.fonts,
      result.defaultFont,
    );
  };

  const handleRemoveFont = (fontToRemove: string) => {
    const result = removeFont(fontEntries, fontToRemove, defaultFont);
    setFontEntries(result.fonts);
    setDefaultFont(result.defaultFont);
    updatePreviewDoc(
      currentBodyHtmlRef.current,
      result.fonts,
      result.defaultFont,
    );
  };

  const handleSetDefaultFont = (fontName: string) => {
    const nextDefault = toggleDefaultFont(fontEntries, defaultFont, fontName);
    setDefaultFont(nextDefault);
    updatePreviewDoc(currentBodyHtmlRef.current, fontEntries, nextDefault);
  };

  const detectedFamilies = extractFontFamilies(fontEntries);
  const cssCount = Object.keys(classesCss).filter((k) =>
    classesCss[k]?.trim(),
  ).length;
  const scriptsCount = Object.keys(scriptsJs).filter((k) =>
    scriptsJs[k]?.trim(),
  ).length;

  return {
    iframeRef,
    srcDoc,
    isEmpty,
    isCollapsed,
    setIsCollapsed,
    isFontsPanelOpen,
    setIsFontsPanelOpen,
    newFontInput,
    setNewFontInput,
    fontEntries,
    defaultFont,
    detectedFamilies,
    cssCount,
    scriptsCount,
    handleAddFont,
    handleRemoveFont,
    handleSetDefaultFont,
  };
}
