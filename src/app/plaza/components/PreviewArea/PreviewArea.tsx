"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { getHtmlJson, getClassesCss } from "@/lib/htmlStorage";
import { treeToHtml } from "@/lib/htmlTree";
import { compileClassesCss } from "@/lib/cssCompiler";

const DB_KEY = "plaza_tree";
const FONTS_STORAGE_KEY = "plaza_preview_fonts";
const DEFAULT_FONT_STORAGE_KEY = "plaza_preview_default_font";
const CLASSES_CSS_STORAGE_KEY = "plaza_classes_css";
const SCRIPTS_STORAGE_KEY = "plaza_scripts_js";

function renderTree(nodes: HtmlNode[]): string {
  return nodes.map((n) => treeToHtml(n, 0)).join("\n");
}

function extractFontFamilies(entries: string[]): string[] {
  const families: Set<string> = new Set();
  const regex = /family=([^&:'"\s\)]+)/g;

  for (const entry of entries) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(entry)) !== null) {
      if (match[1]) {
        const rawName = match[1].split(":")[0];
        const cleanName = decodeURIComponent(
          rawName.replace(/\+/g, " ").trim(),
        );
        if (cleanName) {
          families.add(cleanName);
        }
      }
    }
  }

  return Array.from(families);
}

function parseFontHeaderTag(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("<link")) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return `<link rel="stylesheet" href="${trimmed}">`;
  }

  if (trimmed.includes("@import")) {
    const urlMatch = /url\(['"]?([^'"\)]+)['"]?\)/.exec(trimmed);
    if (urlMatch && urlMatch[1]) {
      return `<link rel="stylesheet" href="${urlMatch[1]}">`;
    }
    return trimmed.startsWith("<style")
      ? trimmed
      : `<style>\n  ${trimmed}\n</style>`;
  }

  if (trimmed.startsWith("<style")) {
    return trimmed;
  }

  return `<link rel="stylesheet" href="${trimmed}">`;
}

/**
 * Собирает итоговый JS-бандл из всех скриптов
 */
function compileScriptsBundle(scriptsJs: Record<string, string> = {}): string {
  const keys = Object.keys(scriptsJs);
  if (keys.length === 0) return "";

  // Если был сохранён общий бандл напрямую
  if (scriptsJs.__bundle__) {
    return scriptsJs.__bundle__;
  }

  const chunks: string[] = [];

  for (const key of keys) {
    const code = (scriptsJs[key] || "").trim();
    if (!code) continue;

    // Оборачиваем скрипт в безопасный IIFE контекст
    chunks.push(`
  /* --- Скрипт: ${key} --- */
  try {
    (function() {
      ${code}
    })();
  } catch (err) {
    console.error("[Plaza Script Error in ${key}]:", err);
  }`);
  }

  return chunks.join("\n\n");
}

function buildDocument(
  bodyHtml: string,
  fontEntries: string[] = [],
  defaultFont = "",
  classesCss: Record<string, string> = {},
  scriptsJs: Record<string, string> = {},
): string {
  const fontsHtml = fontEntries
    .map(parseFontHeaderTag)
    .filter(Boolean)
    .join("\n  ");

  const detectedFamilies = extractFontFamilies(fontEntries);
  const compiledClassesStyles = compileClassesCss(classesCss);
  const compiledBundleScripts = compileScriptsBundle(scriptsJs);

  const helperClasses = detectedFamilies
    .map((name) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      return `
    .${slug}, .font-${slug} {
      font-family: '${name}', sans-serif !important;
    }`;
    })
    .join("\n");

  const tailwindFamiliesObj = detectedFamilies
    .map((name) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      return `'${slug}': ["'${name}'", 'sans-serif']`;
    })
    .join(",\n          ");

  const defaultFontRule = defaultFont
    ? `font-family: '${defaultFont}', sans-serif !important;`
    : `font-family: Arial, Helvetica, sans-serif;`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <script src="https://cdn.tailwindcss.com"><\/script>
  ${fontsHtml}

  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            ${tailwindFamiliesObj}
          }
        }
      }
    }
  <\/script>

  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #171717;
      ${defaultFontRule}
      min-height: 100%;
    }
    ${helperClasses}
  </style>

  ${
    compiledClassesStyles
      ? `<!-- Скомпилированные стили классов из Monaco -->
  <style id="compiled-classes-styles">
/* ==========================================================================
   Скомпилированные стили классов
   ========================================================================== */
${compiledClassesStyles}
  </style>`
      : ""
  }
</head>
<body class="bg-white text-zinc-900">
${bodyHtml}

${
  compiledBundleScripts
    ? `<!-- Итоговый бандл скриптов (JS) -->
<script id="compiled-bundle-scripts">
document.addEventListener("DOMContentLoaded", () => {
${compiledBundleScripts}
});
if (document.readyState === "complete" || document.readyState === "interactive") {
${compiledBundleScripts}
}
<\/script>`
    : ""
}
</body>
</html>`;
}

export function PreviewArea() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const [fontEntries, setFontEntries] = useState<string[]>([]);
  const [defaultFont, setDefaultFont] = useState<string>("");
  const [isFontsPanelOpen, setIsFontsPanelOpen] = useState<boolean>(false);
  const [newFontInput, setNewFontInput] = useState<string>("");

  const [classesCss, setClassesCss] = useState<Record<string, string>>({});
  const classesCssRef = useRef<Record<string, string>>({});
  classesCssRef.current = classesCss;

  const [scriptsJs, setScriptsJs] = useState<Record<string, string>>({});
  const scriptsJsRef = useRef<Record<string, string>>({});
  scriptsJsRef.current = scriptsJs;

  const currentBodyHtmlRef = useRef<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFontEntries(parsed);
        }
      }

      const savedDefault = localStorage.getItem(DEFAULT_FONT_STORAGE_KEY);
      if (savedDefault) {
        setDefaultFont(savedDefault);
      }
    } catch (e) {
      console.error("[PreviewArea] Failed to read fonts from localStorage:", e);
    }

    try {
      const savedCss = localStorage.getItem(CLASSES_CSS_STORAGE_KEY);
      if (savedCss) {
        const parsed = JSON.parse(savedCss);
        if (parsed && typeof parsed === "object") {
          setClassesCss(parsed);
          classesCssRef.current = parsed;
        }
      }
    } catch (e) {
      console.error(
        "[PreviewArea] Failed to read classes CSS from localStorage:",
        e,
      );
    }

    try {
      const savedJs = localStorage.getItem(SCRIPTS_STORAGE_KEY);
      if (savedJs) {
        const parsed = JSON.parse(savedJs);
        if (parsed && typeof parsed === "object") {
          setScriptsJs(parsed);
          scriptsJsRef.current = parsed;
        }
      }
    } catch (e) {
      console.error(
        "[PreviewArea] Failed to read scripts JS from localStorage:",
        e,
      );
    }

    getClassesCss()
      .then((dbStyles) => {
        if (dbStyles && typeof dbStyles === "object") {
          setClassesCss(dbStyles);
          classesCssRef.current = dbStyles;
          if (currentBodyHtmlRef.current) {
            setSrcDoc(
              buildDocument(
                currentBodyHtmlRef.current,
                fontEntries,
                defaultFont,
                dbStyles,
                scriptsJsRef.current,
              ),
            );
          }
        }
      })
      .catch((err) =>
        console.error("[PreviewArea] Failed to read classes CSS from DB:", err),
      );
  }, []);

  const refreshPreview = useCallback(async () => {
    try {
      const data = await getHtmlJson(DB_KEY);
      if (!data) {
        setIsEmpty(true);
        currentBodyHtmlRef.current = "";
        setSrcDoc(
          buildDocument(
            "",
            fontEntries,
            defaultFont,
            classesCssRef.current,
            scriptsJsRef.current,
          ),
        );
        return;
      }
      const nodes: HtmlNode[] = Array.isArray(data) ? data : [data];
      if (nodes.length === 0) {
        setIsEmpty(true);
        currentBodyHtmlRef.current = "";
        setSrcDoc(
          buildDocument(
            "",
            fontEntries,
            defaultFont,
            classesCssRef.current,
            scriptsJsRef.current,
          ),
        );
        return;
      }
      setIsEmpty(false);
      const html = renderTree(nodes);
      currentBodyHtmlRef.current = html;
      setSrcDoc(
        buildDocument(
          html,
          fontEntries,
          defaultFont,
          classesCssRef.current,
          scriptsJsRef.current,
        ),
      );
    } catch (err) {
      console.error("[PreviewArea] Failed to read IndexedDB:", err);
    }
  }, [fontEntries, defaultFont]);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  useEffect(() => {
    const handleTreeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<HtmlNode[]>;
      const nodes = customEvent.detail;
      if (!nodes || nodes.length === 0) {
        setIsEmpty(true);
        currentBodyHtmlRef.current = "";
        setSrcDoc(
          buildDocument(
            "",
            fontEntries,
            defaultFont,
            classesCssRef.current,
            scriptsJsRef.current,
          ),
        );
        return;
      }
      setIsEmpty(false);
      const html = renderTree(nodes);
      currentBodyHtmlRef.current = html;
      setSrcDoc(
        buildDocument(
          html,
          fontEntries,
          defaultFont,
          classesCssRef.current,
          scriptsJsRef.current,
        ),
      );
    };

    window.addEventListener("plaza-tree-updated", handleTreeUpdate);
    return () =>
      window.removeEventListener("plaza-tree-updated", handleTreeUpdate);
  }, [fontEntries, defaultFont]);

  useEffect(() => {
    const handleStylesUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      const nextStyles = customEvent.detail || {};
      setClassesCss(nextStyles);
      classesCssRef.current = nextStyles;

      setSrcDoc(
        buildDocument(
          currentBodyHtmlRef.current,
          fontEntries,
          defaultFont,
          nextStyles,
          scriptsJsRef.current,
        ),
      );
    };

    window.addEventListener("plaza-styles-updated", handleStylesUpdate);
    return () =>
      window.removeEventListener("plaza-styles-updated", handleStylesUpdate);
  }, [fontEntries, defaultFont]);

  // Слушатель обновления JS-скриптов
  useEffect(() => {
    const handleScriptsUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      const nextScripts = customEvent.detail || {};
      setScriptsJs(nextScripts);
      scriptsJsRef.current = nextScripts;

      setSrcDoc(
        buildDocument(
          currentBodyHtmlRef.current,
          fontEntries,
          defaultFont,
          classesCssRef.current,
          nextScripts,
        ),
      );
    };

    window.addEventListener("plaza-scripts-updated", handleScriptsUpdate);
    return () =>
      window.removeEventListener("plaza-scripts-updated", handleScriptsUpdate);
  }, [fontEntries, defaultFont]);

  const handleAddFont = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFontInput.trim();
    if (!trimmed) return;

    if (fontEntries.includes(trimmed)) {
      setNewFontInput("");
      return;
    }

    const next = [...fontEntries, trimmed];
    setFontEntries(next);

    const detected = extractFontFamilies(next);
    let nextDefault = defaultFont;
    if (!nextDefault && detected.length > 0) {
      nextDefault = detected[0];
      setDefaultFont(nextDefault);
      try {
        localStorage.setItem(DEFAULT_FONT_STORAGE_KEY, nextDefault);
      } catch {}
    }

    try {
      localStorage.setItem(FONTS_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error("[PreviewArea] Failed to save fonts to localStorage:", err);
    }

    setNewFontInput("");
    setSrcDoc(
      buildDocument(
        currentBodyHtmlRef.current,
        next,
        nextDefault,
        classesCssRef.current,
        scriptsJsRef.current,
      ),
    );
  };

  const handleRemoveFont = (fontToRemove: string) => {
    const next = fontEntries.filter((f) => f !== fontToRemove);
    setFontEntries(next);

    const detected = extractFontFamilies(next);
    let nextDefault = defaultFont;
    if (!detected.includes(defaultFont)) {
      nextDefault = detected.length > 0 ? detected[0] : "";
      setDefaultFont(nextDefault);
      try {
        localStorage.setItem(DEFAULT_FONT_STORAGE_KEY, nextDefault);
      } catch {}
    }

    try {
      localStorage.setItem(FONTS_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error("[PreviewArea] Failed to save fonts to localStorage:", err);
    }
    setSrcDoc(
      buildDocument(
        currentBodyHtmlRef.current,
        next,
        nextDefault,
        classesCssRef.current,
        scriptsJsRef.current,
      ),
    );
  };

  const handleSetDefaultFont = (fontName: string) => {
    const nextDefault = defaultFont === fontName ? "" : fontName;
    setDefaultFont(nextDefault);
    try {
      localStorage.setItem(DEFAULT_FONT_STORAGE_KEY, nextDefault);
    } catch {}
    setSrcDoc(
      buildDocument(
        currentBodyHtmlRef.current,
        fontEntries,
        nextDefault,
        classesCssRef.current,
        scriptsJsRef.current,
      ),
    );
  };

  const detectedFamilies = extractFontFamilies(fontEntries);

  const cssCount = Object.keys(classesCss).filter((k) =>
    classesCss[k]?.trim(),
  ).length;

  const scriptsCount = Object.keys(scriptsJs).filter((k) =>
    scriptsJs[k]?.trim(),
  ).length;

  return (
    <div className="w-full flex flex-col border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-2 text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
            Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isEmpty && (
            <span className="text-[10px] font-mono text-zinc-600">
              Холст пуст
            </span>
          )}

          {/* Индикатор стилей */}
          <div
            title="Скомпилированные стили классов, внедренные в <head> iframe"
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center gap-1.5 ${
              cssCount > 0
                ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            <span>🎨</span>
            <span className="hidden sm:inline">CSS:</span>
            <span
              className={`font-bold rounded-full px-1 text-[9px] ${cssCount > 0 ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-400"}`}
            >
              {cssCount}
            </span>
          </div>

          {/* Индикатор скриптов */}
          <div
            title="Итоговый бандл JS-скриптов, подключенный в конец <body> iframe"
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center gap-1.5 ${
              scriptsCount > 0
                ? "bg-amber-950/70 border-amber-500/60 text-amber-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            <span>⚡</span>
            <span className="hidden sm:inline">JS:</span>
            <span
              className={`font-bold rounded-full px-1 text-[9px] ${scriptsCount > 0 ? "bg-amber-600 text-white" : "bg-zinc-700 text-zinc-400"}`}
            >
              {scriptsCount}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsFontsPanelOpen((prev) => !prev)}
            title="Настройка подключаемых веб-шрифтов"
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer flex items-center gap-1 ${
              isFontsPanelOpen || fontEntries.length > 0
                ? "bg-indigo-950/80 border-indigo-500/80 text-indigo-300"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700"
            }`}
          >
            <span>🔤</span>
            <span>Шрифты</span>
            {fontEntries.length > 0 && (
              <span className="px-1 bg-indigo-600 text-white rounded-full text-[9px] font-bold">
                {fontEntries.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={refreshPreview}
            title="Обновить превью"
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer"
          >
            ↻ Обновить
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            title={isCollapsed ? "Развернуть" : "Свернуть"}
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer"
          >
            {isCollapsed ? "▾ Развернуть" : "▴ Свернуть"}
          </button>
        </div>
      </div>

      {isFontsPanelOpen && (
        <div className="px-4 py-3 bg-zinc-950/95 border-b border-zinc-800/80 flex flex-col gap-2.5">
          <form
            onSubmit={handleAddFont}
            className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2"
          >
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Вставьте тег &lt;link rel="stylesheet" ...&gt; или URL шрифта:
              </label>
              <textarea
                value={newFontInput}
                onChange={(e) => setNewFontInput(e.target.value)}
                rows={2}
                placeholder={`<link href="https://fonts.googleapis.com/css2?family=Lobster&display=swap" rel="stylesheet">`}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded bg-zinc-900 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-zinc-100 placeholder-zinc-600 transition resize-none custom-scrollbar"
              />
            </div>
            <button
              type="submit"
              disabled={!newFontInput.trim()}
              className="px-4 py-2 self-end sm:self-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition cursor-pointer shrink-0 shadow"
            >
              + Добавить в &lt;head&gt;
            </button>
          </form>

          {detectedFamilies.length > 0 && (
            <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 font-semibold uppercase tracking-wider">
                Активные шрифты:
              </span>
              {detectedFamilies.map((fam) => {
                const isDef = defaultFont === fam;
                const slug = fam.toLowerCase().replace(/\s+/g, "-");
                return (
                  <div
                    key={fam}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200"
                  >
                    <span className="font-semibold text-indigo-300">{fam}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      (класс:{" "}
                      <code className="text-emerald-400">font-{slug}</code>)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSetDefaultFont(fam)}
                      className={`ml-1 text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition ${
                        isDef
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                      }`}
                      title={
                        isDef
                          ? "Активен как шрифт всего сайта"
                          : "Сделать шрифтом всего сайта"
                      }
                    >
                      {isDef ? "✓ По умолчанию" : "Сделать по умолчанию"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {fontEntries.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Код в &lt;head&gt;:
              </span>
              {fontEntries.map((font, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-750 text-zinc-300 text-[11px] font-mono max-w-full"
                >
                  <span className="truncate max-w-[450px]" title={font}>
                    {font.replace(/\n\s*/g, " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFont(font)}
                    className="text-zinc-500 hover:text-red-400 font-bold transition cursor-pointer text-xs leading-none"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-zinc-600 font-mono">
              Вставьте код Google Fonts, и шрифт моментально подключится в
              превью.
            </p>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="relative w-full bg-white" style={{ height: "340px" }}>
          {isEmpty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2 bg-white">
              <span className="text-2xl">🖼️</span>
              <p className="text-sm font-medium text-zinc-400">
                Нет элементов для отображения
              </p>
              <p className="text-xs text-zinc-500">
                Добавьте блоки на холст — они появятся здесь
              </p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              title="Предпросмотр"
              sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>
      )}
    </div>
  );
}
