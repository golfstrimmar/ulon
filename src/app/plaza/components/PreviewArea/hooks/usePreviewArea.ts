"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  getHtmlJson,
  getGlobalScss,
  getScriptsJs,
  getFontsSettings,
} from "@/store/htmlStorage";
import { getColorVariables } from "@/store/figmaColorStorage";
import { compileScssToCss } from "@/lib/scssCompiler";
import {
  DB_KEY,
  renderTree,
  extractFontFamilies,
  buildDocument,
  addFont,
  removeFont,
  toggleDefaultFont,
} from "@/app/plaza/components/PreviewArea/models/previewModel";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

function filterVisibleRootNodes(
  nodes: HtmlNode[],
  collapsedKeys: Set<string>,
): HtmlNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  if (!collapsedKeys || collapsedKeys.size === 0) return nodes;

  return nodes.filter((node) => {
    const key = node._key || (node as any)?.id || "";
    return !key || !collapsedKeys.has(key);
  });
}

function getScssOnlyColorDefs(variables: string[]): string {
  return variables
    .filter((v) => typeof v === "string" && v.trim().startsWith("$"))
    .join("\n");
}

function buildRootColorTokensText(variables: string[]): string {
  const lines = variables
    .map((item) => {
      if (!item || typeof item !== "string") return null;
      const trimmed = item.trim().replace(/;$/, "");
      if (!trimmed) return null;
      const match = trimmed.match(/^(\$[\w-]+|--[\w-]+)\s*:\s*([^;/]+)/);
      if (match) {
        const varName = match[1].replace(/^\$/, "--");
        return `  ${varName}: ${match[2].trim()};`;
      }
      return `  ${trimmed};`;
    })
    .filter(Boolean);

  if (lines.length === 0) return "";
  return `:root {\n${lines.join("\n")}\n}`;
}

export function usePreviewArea() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentBodyHtmlRef = useRef<string>("");
  const latestFullNodesRef = useRef<HtmlNode[]>([]);
  const isInitializedRef = useRef<boolean>(false);

  const currentJson = useCanvasStore((s) => s.currentJson);
  const collapsedKeys = useCanvasStore((s) => s.collapsedKeys);

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

  const [currentBodyHtml, setCurrentBodyHtml] = useState<string>("");

  const colorVariablesRef = useRef<string[]>([]);

  const rebuildEntireIframe = useCallback(
    (
      bodyHtml: string,
      fonts = fontEntriesRef.current,
      defFont = defaultFontRef.current,
      css = compiledCssRef.current,
      scripts = scriptsJsRef.current,
      colors = colorVariablesRef.current,
    ) => {
      currentBodyHtmlRef.current = bodyHtml;
      setCurrentBodyHtml(bodyHtml);
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
    },
    [],
  );

  const applyNodesToPreview = useCallback(
    (fullNodes: HtmlNode[], collapsed: Set<string>) => {
      const visibleNodes = filterVisibleRootNodes(fullNodes, collapsed);
      const nodesToRender =
        visibleNodes.length > 0 ? visibleNodes : fullNodes;
      const nextHtml =
        nodesToRender.length > 0 ? renderTree(nodesToRender) : "";

      if (nextHtml === currentBodyHtmlRef.current) {
        return;
      }

      currentBodyHtmlRef.current = nextHtml;
      setCurrentBodyHtml(nextHtml);
      setIsEmpty(!nextHtml.trim());

      const iframeDoc = iframeRef.current?.contentDocument;
      if (iframeDoc && iframeDoc.body) {
        iframeDoc.body.innerHTML = nextHtml;

        const rawJs =
          scriptsJsRef.current.__bundle__ ||
          Object.values(scriptsJsRef.current).join("\n\n");
        const code = (rawJs || "").trim();
        if (code) {
          iframeDoc.getElementById("compiled-bundle-scripts")?.remove();
          const script = iframeDoc.createElement("script");
          script.id = "compiled-bundle-scripts";
          script.textContent = code;
          iframeDoc.body.appendChild(script);
        }

        return;
      }

      rebuildEntireIframe(nextHtml);
    },
    [rebuildEntireIframe],
  );

  async function initPreview() {
    try {
      const [rawTree, dbScss, dbScripts, dbFonts, dbColors] = await Promise.all(
        [
          getHtmlJson(DB_KEY).catch(() => null),
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

      const colorDefs = getScssOnlyColorDefs(loadedColors);
      const scssWithColors = colorDefs
        ? `${colorDefs}\n${dbScss || ""}`
        : dbScss || "";

      const css = await compileScssToCss(scssWithColors);
      setCompiledCss(css);
      compiledCssRef.current = css;

      let initialHtml = "";
      const storeNodes = useCanvasStore.getState().currentJson;
      const targetData =
        storeNodes && storeNodes.length > 0 ? storeNodes : rawTree;
      if (targetData) {
        const nodes: HtmlNode[] = Array.isArray(targetData)
          ? targetData
          : [targetData];
        latestFullNodesRef.current = nodes;
        const visibleNodes = filterVisibleRootNodes(
          nodes,
          useCanvasStore.getState().collapsedKeys,
        );
        const nodesToRender =
          visibleNodes.length > 0 ? visibleNodes : nodes;
        if (nodesToRender.length > 0) {
          initialHtml = renderTree(nodesToRender);
        }
      } else {
        latestFullNodesRef.current = [];
      }

      currentBodyHtmlRef.current = initialHtml;
      setCurrentBodyHtml(initialHtml);
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
      isInitializedRef.current = true;
    } catch (err) {
      console.error("[usePreviewArea] IndexedDB init preview error:", err);
    }
  }

  useEffect(() => {
    initPreview();
  }, []);

  useEffect(() => {
    const handleTreeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const detail = customEvent.detail;

      const nodes: HtmlNode[] = Array.isArray(detail)
        ? detail
        : Array.isArray(detail?.nodes)
          ? detail.nodes
          : [];

      latestFullNodesRef.current = nodes;
      applyNodesToPreview(nodes, useCanvasStore.getState().collapsedKeys);
    };

    window.addEventListener("plaza-tree-updated", handleTreeUpdate);
    return () =>
      window.removeEventListener("plaza-tree-updated", handleTreeUpdate);
  }, [applyNodesToPreview]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    const fullNodes =
      currentJson.length > 0 ? currentJson : latestFullNodesRef.current;
    applyNodesToPreview(fullNodes, collapsedKeys);
  }, [currentJson, collapsedKeys, applyNodesToPreview]);

  useEffect(() => {
    const handleStylesUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent<string | Record<string, string>>;
      let rawScss = "";
      if (typeof customEvent.detail === "string") {
        rawScss = customEvent.detail;
      } else if (customEvent.detail && typeof customEvent.detail === "object") {
        rawScss = Object.values(customEvent.detail).join("\n\n");
      }

      const colorDefs = getScssOnlyColorDefs(colorVariablesRef.current);
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
  }, [rebuildEntireIframe]);

  useEffect(() => {
    const handleColorsUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const rawColors =
        customEvent.detail !== undefined
          ? customEvent.detail
          : await getColorVariables().catch(() => []);

      const normalizedColors: string[] = Array.isArray(rawColors)
        ? rawColors
        : rawColors &&
            typeof rawColors === "object" &&
            Array.isArray(rawColors.variables)
          ? rawColors.variables
          : [];

      colorVariablesRef.current = normalizedColors;

      const rawScss = await getGlobalScss().catch(() => "");
      const colorDefs = getScssOnlyColorDefs(normalizedColors);
      const scssWithColors = colorDefs
        ? `${colorDefs}\n${rawScss || ""}`
        : rawScss || "";

      const css = await compileScssToCss(scssWithColors);
      setCompiledCss(css);
      compiledCssRef.current = css;

      const iframeDoc = iframeRef.current?.contentDocument;
      if (iframeDoc && iframeDoc.head) {
        iframeDoc.getElementById("figma-color-tokens")?.remove();
        const tokensCss = buildRootColorTokensText(normalizedColors);
        if (tokensCss) {
          const tokensTag = iframeDoc.createElement("style");
          tokensTag.id = "figma-color-tokens";
          tokensTag.textContent = tokensCss;
          iframeDoc.head.appendChild(tokensTag);
        }

        iframeDoc.getElementById("compiled-classes-styles")?.remove();
        const newStyleTag = iframeDoc.createElement("style");
        newStyleTag.id = "compiled-classes-styles";
        newStyleTag.textContent = css;
        iframeDoc.head.appendChild(newStyleTag);
        return;
      }

      rebuildEntireIframe(
        currentBodyHtmlRef.current,
        undefined,
        undefined,
        css,
        undefined,
        normalizedColors,
      );
    };

    window.addEventListener("figma_colors:saved", handleColorsUpdate);
    return () =>
      window.removeEventListener("figma_colors:saved", handleColorsUpdate);
  }, [rebuildEntireIframe]);

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

      const rawJs =
        nextScripts.__bundle__ || Object.values(nextScripts).join("\n\n");
      const newCode = (rawJs || "").trim();

      const iframeDoc = iframeRef.current?.contentDocument;

      if (iframeDoc && iframeDoc.body) {
        iframeDoc.getElementById("compiled-bundle-scripts")?.remove();

        if (newCode) {
          const script = iframeDoc.createElement("script");
          script.id = "compiled-bundle-scripts";
          script.textContent = newCode;
          iframeDoc.body.appendChild(script);
        }
        return;
      }

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
  }, [rebuildEntireIframe]);

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
  }, [rebuildEntireIframe]);

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
    currentBodyHtml,
    handleAddFont,
    handleRemoveFont,
    handleSetDefaultFont,
  };
}
