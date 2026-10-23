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

/**
 * Рекурсивно превращает массив HtmlNode в HTML-строку.
 */
function renderTree(nodes: HtmlNode[]): string {
  return nodes.map((n) => treeToHtml(n, 0)).join("\n");
}

/**
 * Извлекает имена семейств шрифтов из ссылок Google Fonts.
 * Например: family=Edu+QLD+Hand:wght@400..700&family=Lobster -> ['Edu QLD Hand', 'Lobster']
 */
function extractFontFamilies(entries: string[]): string[] {
  const families: Set<string> = new Set();
  const regex = /family=([^&:'"\s\)]+)/g;

  for (const entry of entries) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(entry)) !== null) {
      if (match[1]) {
        // Убираем параметры веса :wght@...
        const rawName = match[1].split(":")[0];
        const cleanName = decodeURIComponent(rawName.replace(/\+/g, " ").trim());
        if (cleanName) {
          families.add(cleanName);
        }
      }
    }
  }

  return Array.from(families);
}

/**
 * Преобразует введенную ссылку/импорт в корректный тег <link rel="stylesheet"> для <head>.
 * Поддерживает:
 * - <link href="..." rel="stylesheet">
 * - https://fonts.googleapis.com/...
 * - @import url('...');
 */
function parseFontHeaderTag(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return "";

  // Если это уже тег <link ...>
  if (trimmed.startsWith("<link")) {
    return trimmed;
  }

  // Если это чистый URL (https://...)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return `<link rel="stylesheet" href="${trimmed}">`;
  }

  // Если это @import url('...') — преобразуем в <link>
  if (trimmed.includes("@import")) {
    const urlMatch = /url\(['"]?([^'"\)]+)['"]?\)/.exec(trimmed);
    if (urlMatch && urlMatch[1]) {
      return `<link rel="stylesheet" href="${urlMatch[1]}">`;
    }
    return trimmed.startsWith("<style") ? trimmed : `<style>\n  ${trimmed}\n</style>`;
  }

  // Если это <style>...</style>
  if (trimmed.startsWith("<style")) {
    return trimmed;
  }

  return `<link rel="stylesheet" href="${trimmed}">`;
}

/**
 * Собирает полный HTML-документ для iframe.
 * Включает:
 * 1. Preconnect к Google Fonts
 * 2. Внедрение тегов <link rel="stylesheet"> в <head>
 * 3. Генерацию вспомогательных классов для каждого шрифта (.font-barlow-condensed, .font-lobster)
 * 4. Настройку Tailwind fontFamily
 * 5. Опциональный шрифт по умолчанию для всего body
 */
function buildDocument(
  bodyHtml: string,
  fontEntries: string[] = [],
  defaultFont = "",
  classesCss: Record<string, string> = {}
): string {
  const fontsHtml = fontEntries
    .map(parseFontHeaderTag)
    .filter(Boolean)
    .join("\n  ");

  const detectedFamilies = extractFontFamilies(fontEntries);
  const compiledClassesStyles = compileClassesCss(classesCss);

  // Генерируем хелпер-классы и конфиг Tailwind для каждого распознанного шрифта
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
</body>
</html>`;
}

export function PreviewArea() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Состояние шрифтов
  const [fontEntries, setFontEntries] = useState<string[]>([]);
  const [defaultFont, setDefaultFont] = useState<string>("");
  const [isFontsPanelOpen, setIsFontsPanelOpen] = useState<boolean>(false);
  const [newFontInput, setNewFontInput] = useState<string>("");

  // Скомпилированные стили классов из Monaco
  const [classesCss, setClassesCss] = useState<Record<string, string>>({});
  const classesCssRef = useRef<Record<string, string>>({});
  classesCssRef.current = classesCss;

  // Хранилище последнего сгенерированного body HTML
  const currentBodyHtmlRef = useRef<string>("");

  // Чтение сохраненных шрифтов, дефолтного шрифта и стилей классов при старте
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

    // Чтение стилей классов из localStorage (быстрый старт)
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
      console.error("[PreviewArea] Failed to read classes CSS from localStorage:", e);
    }

    // Чтение стилей классов из IndexedDB (авторитетный источник)
    getClassesCss()
      .then((dbStyles) => {
        if (dbStyles && typeof dbStyles === "object") {
          setClassesCss(dbStyles);
          classesCssRef.current = dbStyles;
          // Обновляем превью с актуальным списком стилей из БД
          if (currentBodyHtmlRef.current) {
            setSrcDoc(buildDocument(currentBodyHtmlRef.current, fontEntries, defaultFont, dbStyles));
          }
        }
      })
      .catch((err) => console.error("[PreviewArea] Failed to read classes CSS from DB:", err));
  }, []);

  /** Читает дерево из IndexedDB и генерирует HTML для iframe */
  const refreshPreview = useCallback(async () => {
    try {
      const data = await getHtmlJson(DB_KEY);
      if (!data) {
        setIsEmpty(true);
        currentBodyHtmlRef.current = "";
        setSrcDoc(buildDocument("", fontEntries, defaultFont, classesCssRef.current));
        return;
      }
      const nodes: HtmlNode[] = Array.isArray(data) ? data : [data];
      if (nodes.length === 0) {
        setIsEmpty(true);
        currentBodyHtmlRef.current = "";
        setSrcDoc(buildDocument("", fontEntries, defaultFont, classesCssRef.current));
        return;
      }
      setIsEmpty(false);
      const html = renderTree(nodes);
      currentBodyHtmlRef.current = html;
      setSrcDoc(buildDocument(html, fontEntries, defaultFont, classesCssRef.current));
    } catch (err) {
      console.error("[PreviewArea] Failed to read IndexedDB:", err);
    }
  }, [fontEntries, defaultFont]);

  /** При монтировании и при смене списка шрифтов — обновляем превью */
  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  /** Слушаем кастомное событие от CanvasArea при каждом сохранении дерева */
  useEffect(() => {
    const handleTreeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<HtmlNode[]>;
      const nodes = customEvent.detail;
      if (!nodes || nodes.length === 0) {
        setIsEmpty(true);
        currentBodyHtmlRef.current = "";
        setSrcDoc(buildDocument("", fontEntries, defaultFont, classesCssRef.current));
        return;
      }
      setIsEmpty(false);
      const html = renderTree(nodes);
      currentBodyHtmlRef.current = html;
      setSrcDoc(buildDocument(html, fontEntries, defaultFont, classesCssRef.current));
    };

    window.addEventListener("plaza-tree-updated", handleTreeUpdate);
    return () => window.removeEventListener("plaza-tree-updated", handleTreeUpdate);
  }, [fontEntries, defaultFont]);

  /** Слушаем кастомное событие изменения стилей классов из Monaco */
  useEffect(() => {
    const handleStylesUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      const nextStyles = customEvent.detail || {};
      setClassesCss(nextStyles);
      classesCssRef.current = nextStyles;

      let bodyHtml = currentBodyHtmlRef.current;
      if (!bodyHtml) {
        try {
          const data = await getHtmlJson(DB_KEY);
          if (data) {
            const nodes = Array.isArray(data) ? data : [data];
            bodyHtml = renderTree(nodes);
            currentBodyHtmlRef.current = bodyHtml;
          }
        } catch {}
      }

      setSrcDoc(
        buildDocument(
          bodyHtml,
          fontEntries,
          defaultFont,
          nextStyles
        )
      );
    };

    window.addEventListener("plaza-styles-updated", handleStylesUpdate);
    return () => window.removeEventListener("plaza-styles-updated", handleStylesUpdate);
  }, [fontEntries, defaultFont]);

  // Добавление новой ссылки/тега на шрифт
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

    // Если шрифт по умолчанию еще не выбран, выберем первый обнаруженный
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
    setSrcDoc(buildDocument(currentBodyHtmlRef.current, next, nextDefault, classesCssRef.current));
  };

  // Удаление шрифта
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
    setSrcDoc(buildDocument(currentBodyHtmlRef.current, next, nextDefault, classesCssRef.current));
  };

  // Переключение шрифта по умолчанию для всего тела сайта
  const handleSetDefaultFont = (fontName: string) => {
    const nextDefault = defaultFont === fontName ? "" : fontName;
    setDefaultFont(nextDefault);
    try {
      localStorage.setItem(DEFAULT_FONT_STORAGE_KEY, nextDefault);
    } catch {}
    setSrcDoc(buildDocument(currentBodyHtmlRef.current, fontEntries, nextDefault, classesCssRef.current));
  };

  const detectedFamilies = extractFontFamilies(fontEntries);

  return (
    <div className="w-full flex flex-col border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 shadow-xl">
      {/* Заголовок панели превью */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-2">
          {/* Цветные кружки в духе браузерного окна */}
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-2 text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
            Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isEmpty && (
            <span className="text-[10px] font-mono text-zinc-600">Холст пуст</span>
          )}

          {/* Индикатор скомпилированных стилей классов */}
          {(() => {
            const count = Object.keys(classesCss).filter((k) =>
              classesCss[k]?.trim()
            ).length;
            return (
              <div
                title="Скомпилированные стили классов, внедренные в <head> iframe"
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center gap-1.5 ${
                  count > 0
                    ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
                    : "bg-zinc-800 border-zinc-700 text-zinc-500"
                }`}
              >
                <span>🎨</span>
                <span className="hidden sm:inline">CSS в &lt;head&gt;:</span>
                <span className={`font-bold rounded-full px-1 text-[9px] ${count > 0 ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-400"}`}>
                  {count}
                </span>
              </div>
            );
          })()}

          {/* Кнопка открытия панели шрифтов */}
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

      {/* Панель добавления шрифтов */}
      {isFontsPanelOpen && (
        <div className="px-4 py-3 bg-zinc-950/95 border-b border-zinc-800/80 flex flex-col gap-2.5">
          <form onSubmit={handleAddFont} className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
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
              className="px-4 py-2 self-end sm:self-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition cursor-pointer shrink-0 shadow"
            >
              + Добавить в &lt;head&gt;
            </button>
          </form>

          {/* Распознанные шрифты и выбор дефолтного */}
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
                      (класс: <code className="text-emerald-400">font-{slug}</code>)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSetDefaultFont(fam)}
                      className={`ml-1 text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition ${
                        isDef
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                      }`}
                      title={isDef ? "Активен как шрифт всего сайта" : "Сделать шрифтом всего сайта"}
                    >
                      {isDef ? "✓ По умолчанию" : "Сделать по умолчанию"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Список подключенных сниппетов */}
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
              Вставьте код Google Fonts (&lt;style&gt; @import... &lt;/style&gt; или &lt;link...&gt;), и шрифт моментально подключится в превью.
            </p>
          )}
        </div>
      )}

      {/* iframe с белым фоном */}
      {!isCollapsed && (
        <div className="relative w-full bg-white" style={{ height: "340px" }}>
          {isEmpty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2 bg-white">
              <span className="text-2xl">🖼️</span>
              <p className="text-sm font-medium text-zinc-400">Нет элементов для отображения</p>
              <p className="text-xs text-zinc-500">Добавьте блоки на холст — они появятся здесь</p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              title="Предпросмотр"
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>
      )}
    </div>
  );
}
