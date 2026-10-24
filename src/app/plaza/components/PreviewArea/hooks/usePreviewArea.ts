"use client";

import { useState, useRef, useEffect } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  getHtmlJson,
  getClassesCss,
  getScriptsJs,
  getFontsSettings,
  saveFontsSettings,
} from "@/lib/htmlStorage";
import {
  DB_KEY,
  renderTree,
  extractFontFamilies,
  buildDocument,
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

  // Данные документа (в памяти)
  const [fontEntries, setFontEntries] = useState<string[]>([]);
  const fontEntriesRef = useRef<string[]>([]);
  fontEntriesRef.current = fontEntries;

  const [defaultFont, setDefaultFont] = useState<string>("");
  const defaultFontRef = useRef<string>("");
  defaultFontRef.current = defaultFont;

  const [classesCss, setClassesCss] = useState<Record<string, string>>({});
  const classesCssRef = useRef<Record<string, string>>({});
  classesCssRef.current = classesCss;

  const [scriptsJs, setScriptsJs] = useState<Record<string, string>>({});
  const scriptsJsRef = useRef<Record<string, string>>({});
  scriptsJsRef.current = scriptsJs;

  // Вспомогательная функция обновления документа в iframe (из памяти)
  const updatePreviewDoc = (
    bodyHtml: string,
    fonts = fontEntriesRef.current,
    defFont = defaultFontRef.current,
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
     1. ПЕРВОНАЧАЛЬНАЯ ЗАГРУЗКА ИЗ INDEXEDDB ПРИ СТАРТЕ
     ========================================================================== */
  useEffect(() => {
    async function initPreview() {
      try {
        const [rawTree, dbStyles, dbScripts, dbFonts] = await Promise.all([
          getHtmlJson(DB_KEY),
          getClassesCss().catch(() => ({})),
          getScriptsJs().catch(() => ({})),
          getFontsSettings().catch(() => ({ fonts: [], defaultFont: "" })),
        ]);

        const loadedStyles = dbStyles || {};
        const loadedScripts = dbScripts || {};
        const loadedFonts = dbFonts?.fonts || [];
        const loadedDefaultFont = dbFonts?.defaultFont || "";

        setClassesCss(loadedStyles);
        classesCssRef.current = loadedStyles;

        setScriptsJs(loadedScripts);
        scriptsJsRef.current = loadedScripts;

        setFontEntries(loadedFonts);
        fontEntriesRef.current = loadedFonts;

        setDefaultFont(loadedDefaultFont);
        defaultFontRef.current = loadedDefaultFont;

        // Формируем HTML дерева разметки
        let initialHtml = "";
        if (rawTree) {
          const nodes: HtmlNode[] = Array.isArray(rawTree)
            ? rawTree
            : [rawTree];
          if (nodes.length > 0) {
            initialHtml = renderTree(nodes);
          }
        }

        // Рендеринг собранного документа
        currentBodyHtmlRef.current = initialHtml;
        setIsEmpty(!initialHtml.trim());
        setSrcDoc(
          buildDocument({
            bodyHtml: initialHtml,
            fontEntries: loadedFonts,
            defaultFont: loadedDefaultFont,
            classesCss: loadedStyles,
            scriptsJs: loadedScripts,
          }),
        );
      } catch (err) {
        console.error("[usePreviewArea] IndexedDB init preview error:", err);
      }
    }

    initPreview();
  }, []);

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
  }, []);

  // Изменение стилей CSS
  useEffect(() => {
    const handleStylesUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      const nextStyles = customEvent.detail || {};
      setClassesCss(nextStyles);
      classesCssRef.current = nextStyles;
      updatePreviewDoc(
        currentBodyHtmlRef.current,
        fontEntriesRef.current,
        defaultFontRef.current,
        nextStyles,
        scriptsJsRef.current,
      );
    };

    window.addEventListener("plaza-styles-updated", handleStylesUpdate);
    return () =>
      window.removeEventListener("plaza-styles-updated", handleStylesUpdate);
  }, []);

  // Изменение скриптов JS
  useEffect(() => {
    const handleScriptsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      const nextScripts = customEvent.detail || {};
      setScriptsJs(nextScripts);
      scriptsJsRef.current = nextScripts;
      updatePreviewDoc(
        currentBodyHtmlRef.current,
        fontEntriesRef.current,
        defaultFontRef.current,
        classesCssRef.current,
        nextScripts,
      );
    };

    window.addEventListener("plaza-scripts-updated", handleScriptsUpdate);
    return () =>
      window.removeEventListener("plaza-scripts-updated", handleScriptsUpdate);
  }, []);

  /* ==========================================================================
     3. ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ СО ШРИФТАМИ (Сохранение в IndexedDB)
     ========================================================================== */

  const handleAddFont = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFontInput.trim()) return;

    const result = addFont(fontEntries, newFontInput, defaultFont);
    setFontEntries(result.fonts);
    fontEntriesRef.current = result.fonts;

    setDefaultFont(result.defaultFont);
    defaultFontRef.current = result.defaultFont;

    setNewFontInput("");
    updatePreviewDoc(
      currentBodyHtmlRef.current,
      result.fonts,
      result.defaultFont,
    );

    await saveFontsSettings({
      fonts: result.fonts,
      defaultFont: result.defaultFont,
    });
  };

  const handleRemoveFont = async (fontToRemove: string) => {
    const result = removeFont(fontEntries, fontToRemove, defaultFont);
    setFontEntries(result.fonts);
    fontEntriesRef.current = result.fonts;

    setDefaultFont(result.defaultFont);
    defaultFontRef.current = result.defaultFont;

    updatePreviewDoc(
      currentBodyHtmlRef.current,
      result.fonts,
      result.defaultFont,
    );

    await saveFontsSettings({
      fonts: result.fonts,
      defaultFont: result.defaultFont,
    });
  };

  const handleSetDefaultFont = async (fontName: string) => {
    const nextDefault = toggleDefaultFont(fontEntries, defaultFont, fontName);
    setDefaultFont(nextDefault);
    defaultFontRef.current = nextDefault;

    updatePreviewDoc(currentBodyHtmlRef.current, fontEntries, nextDefault);

    await saveFontsSettings({
      fonts: fontEntries,
      defaultFont: nextDefault,
    });
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
