"use client";

import { useState, useRef, useEffect } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  getHtmlJson,
  getGlobalScss,
  getScriptsJs,
  getFontsSettings,
} from "@/lib/htmlStorage";
import { getColorVariables } from "@/lib/figmaColorStorage";
import { compileScssToCss } from "@/lib/scssCompiler";
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

  const [srcDoc, setSrcDoc] = useState<string>("");
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isFontsPanelOpen, setIsFontsPanelOpen] = useState<boolean>(false);
  const [newFontInput, setNewFontInput] = useState<string>("");

  const fontEntriesRef = useRef<string[]>([]);
  const [fontEntries, setFontEntries] = useState<string[]>([]);

  const defaultFontRef = useRef<string>("");
  const [defaultFont, setDefaultFont] = useState<string>("");

  const compiledCssRef = useRef<string>("");
  const [compiledCss, setCompiledCss] = useState<string>("");

  const scriptsJsRef = useRef<Record<string, string>>({});
  const [scriptsJs, setScriptsJs] = useState<Record<string, string>>({});

  const colorVariablesRef = useRef<string[]>([]);

  // Полная пересборка srcDoc (только при старте или смене шрифтов/скриптов)
  const rebuildEntireIframe = (
    bodyHtml: string,
    fonts = fontEntriesRef.current,
    defFont = defaultFontRef.current,
    css = compiledCssRef.current,
    scripts = scriptsJsRef.current,
    colors = colorVariablesRef.current,
  ) => {
    currentBodyHtmlRef.current = bodyHtml;
    setIsEmpty(!bodyHtml.trim());
    setSrcDoc(
      buildDocument({
        bodyHtml,
        fontEntries: fonts,
        defaultFont: defFont,
        globalCss: css,
        scriptsJs: scripts,
        colorVariables: colors,
      }),
    );
  };

  /* ==========================================================================
     1. ПЕРВОНАЧАЛЬНАЯ ЗАГРУЗКА ПРИ СТАРТЕ
     ========================================================================== */
  async function initPreview() {
    try {
      const [rawTree, dbScss, dbScripts, dbFonts, dbColors] = await Promise.all(
        [
          getHtmlJson(DB_KEY),
          getGlobalScss().catch(() => ""),
          getScriptsJs().catch(() => ({})),
          getFontsSettings().catch(() => ({ fonts: [], defaultFont: "" })),
          getColorVariables().catch(() => []),
        ],
      );

      const loadedScripts = dbScripts || {};
      const loadedFonts = dbFonts?.fonts || [];
      const loadedDefaultFont = dbFonts?.defaultFont || "";

      const loadedColors: string[] = Array.isArray(dbColors)
        ? dbColors
        : dbColors &&
            typeof dbColors === "object" &&
            Array.isArray((dbColors as any).variables)
          ? (dbColors as any).variables
          : [];

      colorVariablesRef.current = loadedColors;

      setFontEntries(loadedFonts);
      fontEntriesRef.current = loadedFonts;
      setDefaultFont(loadedDefaultFont);
      defaultFontRef.current = loadedDefaultFont;
      setScriptsJs(loadedScripts);
      scriptsJsRef.current = loadedScripts;

      const css = await compileScssToCss(dbScss || "");
      setCompiledCss(css);
      compiledCssRef.current = css;

      let initialHtml = "";
      if (rawTree) {
        const nodes: HtmlNode[] = Array.isArray(rawTree) ? rawTree : [rawTree];
        if (nodes.length > 0) {
          initialHtml = renderTree(nodes);
        }
      }

      currentBodyHtmlRef.current = initialHtml;
      setIsEmpty(!initialHtml.trim());
      setSrcDoc(
        buildDocument({
          bodyHtml: initialHtml,
          fontEntries: loadedFonts,
          defaultFont: loadedDefaultFont,
          globalCss: css,
          scriptsJs: loadedScripts,
          colorVariables: loadedColors,
        }),
      );
    } catch (err) {
      console.error("[usePreviewArea] IndexedDB init preview error:", err);
    }
  }

  useEffect(() => {
    initPreview();
  }, []);

  /* ==========================================================================
     2. ОБНОВЛЕНИЕ ДЕРЕВА НОД БЕЗ МОРГАНИЯ И ПЕРЕСБОРКИ IFRAME
     ========================================================================== */
  useEffect(() => {
    const handleTreeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const detail = customEvent.detail;

      // Корректно извлекаем массив нод из любого формата события
      const nodes: HtmlNode[] = Array.isArray(detail)
        ? detail
        : Array.isArray(detail?.nodes)
          ? detail.nodes
          : [];

      const nextHtml = nodes.length > 0 ? renderTree(nodes) : "";

      if (nextHtml === currentBodyHtmlRef.current) {
        return;
      }

      currentBodyHtmlRef.current = nextHtml;
      setIsEmpty(!nextHtml.trim());

      const iframeDoc = iframeRef.current?.contentDocument;
      // 🚀 Вставляем HTML напрямую в body. iframe НЕ перезагружается, белого экрана нет!
      if (iframeDoc && iframeDoc.body) {
        iframeDoc.body.innerHTML = nextHtml;
        return;
      }

      rebuildEntireIframe(nextHtml);
    };

    window.addEventListener("plaza-tree-updated", handleTreeUpdate);
    return () =>
      window.removeEventListener("plaza-tree-updated", handleTreeUpdate);
  }, []);

  /* ==========================================================================
     3. ОБНОВЛЕНИЕ SCSS
     ========================================================================== */
  useEffect(() => {
    const handleStylesUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent<string | Record<string, string>>;
      let rawScss = "";
      if (typeof customEvent.detail === "string") {
        rawScss = customEvent.detail;
      } else if (customEvent.detail && typeof customEvent.detail === "object") {
        rawScss = Object.values(customEvent.detail).join("\n\n");
      }

      const colorDefs = colorVariablesRef.current.join("\n");
      const scssWithColors = colorDefs ? `${colorDefs}\n${rawScss}` : rawScss;

      const css = await compileScssToCss(scssWithColors);
      setCompiledCss(css);
      compiledCssRef.current = css;

      const iframeDoc = iframeRef.current?.contentDocument;
      if (iframeDoc && iframeDoc.head) {
        const oldTag = iframeDoc.getElementById("compiled-classes-styles");
        if (oldTag) oldTag.remove();

        const newStyleTag = iframeDoc.createElement("style");
        newStyleTag.id = "compiled-classes-styles";
        newStyleTag.textContent = css;
        iframeDoc.head.appendChild(newStyleTag);

        iframeDoc.getElementById("__plaza_live_quick_style__")?.remove();
        document.getElementById("__plaza_live_quick_style__")?.remove();
        return;
      }

      rebuildEntireIframe(
        currentBodyHtmlRef.current,
        undefined,
        undefined,
        css,
      );
    };

    window.addEventListener("plaza-styles-updated", handleStylesUpdate);
    return () =>
      window.removeEventListener("plaza-styles-updated", handleStylesUpdate);
  }, []);

  // Обновление скриптов JS
  useEffect(() => {
    const handleScriptsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string | Record<string, string>>;
      let nextScripts: Record<string, string> = {};

      if (typeof customEvent.detail === "string") {
        nextScripts = customEvent.detail
          ? { __bundle__: customEvent.detail }
          : {};
      } else if (customEvent.detail && typeof customEvent.detail === "object") {
        nextScripts = customEvent.detail;
      }

      setScriptsJs(nextScripts);
      scriptsJsRef.current = nextScripts;

      rebuildEntireIframe(
        currentBodyHtmlRef.current,
        undefined,
        undefined,
        undefined,
        nextScripts,
      );
    };

    window.addEventListener("plaza-scripts-updated", handleScriptsUpdate);
    return () =>
      window.removeEventListener("plaza-scripts-updated", handleScriptsUpdate);
  }, []);

  // Обновление шрифтов
  useEffect(() => {
    const handleFontsSync = (e: Event) => {
      const customEvent = e as CustomEvent<{
        fonts: string[];
        defaultFont: string;
      }>;
      if (!customEvent.detail) return;
      const { fonts, defaultFont: nextDef } = customEvent.detail;

      setFontEntries(fonts);
      fontEntriesRef.current = fonts;
      setDefaultFont(nextDef);
      defaultFontRef.current = nextDef;

      rebuildEntireIframe(currentBodyHtmlRef.current, fonts, nextDef);
    };

    window.addEventListener("plaza-fonts-updated", handleFontsSync);
    return () =>
      window.removeEventListener("plaza-fonts-updated", handleFontsSync);
  }, []);

  const broadcastFonts = (fonts: string[], defFont: string) => {
    window.dispatchEvent(
      new CustomEvent("plaza-fonts-updated", {
        detail: { fonts, defaultFont: defFont },
      }),
    );
  };

  const openModalFonts = () => {
    setIsFontsPanelOpen((prev) => {
      const next = !prev;
      window.dispatchEvent(
        new CustomEvent("preview-fontspanel", { detail: next }),
      );
      return next;
    });
  };

  const handleAddFont = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFontInput.trim()) return;

    const result = await addFont(fontEntries, newFontInput, defaultFont);
    setFontEntries(result.fonts);
    fontEntriesRef.current = result.fonts;
    setDefaultFont(result.defaultFont);
    defaultFontRef.current = result.defaultFont;
    setNewFontInput("");

    broadcastFonts(result.fonts, result.defaultFont);
  };

  const handleRemoveFont = async (fontToRemove: string) => {
    const result = await removeFont(fontEntries, fontToRemove, defaultFont);
    setFontEntries(result.fonts);
    fontEntriesRef.current = result.fonts;
    setDefaultFont(result.defaultFont);
    defaultFontRef.current = result.defaultFont;

    broadcastFonts(result.fonts, result.defaultFont);
  };

  const handleSetDefaultFont = async (fontName: string) => {
    const nextDefault = await toggleDefaultFont(
      fontEntries,
      defaultFont,
      fontName,
    );
    setDefaultFont(nextDefault);
    defaultFontRef.current = nextDefault;

    broadcastFonts(fontEntries, nextDefault);
  };

  const detectedFamilies = extractFontFamilies(fontEntries);
  const cssCount = compiledCss.trim() ? 1 : 0;
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
    openModalFonts,
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
