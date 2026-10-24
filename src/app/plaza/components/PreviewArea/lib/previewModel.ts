// Отвечает за: структуры данных, парсинг ссылок шрифтов, сборку HTML-строки, изоляцию скриптов,
// сохранение в localStorage и чистые бизнес-правила мутаций. Не зависит от React.

import type { HtmlNode } from "@/types/HtmlNode";
import { treeToHtml } from "@/lib/htmlTree";
import { compileClassesCss } from "@/lib/cssCompiler";

/* ==========================================================================
   1. СХЕМЫ ДАННЫХ (Data Contracts)
   ========================================================================== */

export interface PreviewSettings {
  fonts: string[];
  defaultFont: string;
  classesCss: Record<string, string>;
  scriptsJs: Record<string, string>;
}

export interface BuildDocumentParams {
  bodyHtml: string;
  fontEntries?: string[];
  defaultFont?: string;
  classesCss?: Record<string, string>;
  scriptsJs?: Record<string, string>;
}

export interface FontMutationResult {
  fonts: string[];
  defaultFont: string;
}

/* ==========================================================================
   2. КОНСТАНТЫ ХРАНИЛИЩА (Storage Keys)
   ========================================================================== */

export const DB_KEY = "plaza_tree";
export const FONTS_STORAGE_KEY = "plaza_preview_fonts";
export const DEFAULT_FONT_STORAGE_KEY = "plaza_preview_default_font";
export const CLASSES_CSS_STORAGE_KEY = "plaza_classes_css";
export const SCRIPTS_STORAGE_KEY = "plaza_scripts_js";

/* ==========================================================================
   3. ПАРСИНГ И ТРАНСФОРМАЦИЯ ДАННЫХ (Domain Functions)
   ========================================================================== */

/**
 * Преобразует дерево DOM-узлов в HTML разметку
 */
export function renderTree(nodes: HtmlNode[]): string {
  return nodes.map((n) => treeToHtml(n, 0)).join("\n");
}

/**
 * Извлекает названия семейств шрифтов из Google Fonts ссылок
 */
export function extractFontFamilies(entries: string[]): string[] {
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

/**
 * Нормализует строку подключения шрифта к валидному HTML-тегу (<link> или <style>)
 */
export function parseFontHeaderTag(entry: string): string {
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
 * Изолирует пользовательские JS-скрипты в безопасные IIFE-контейнеры
 */
export function compileScriptsBundle(
  scriptsJs: Record<string, string> = {},
): string {
  const keys = Object.keys(scriptsJs);
  if (keys.length === 0) return "";

  if (scriptsJs.__bundle__) {
    return scriptsJs.__bundle__;
  }

  const chunks: string[] = [];

  for (const key of keys) {
    const code = (scriptsJs[key] || "").trim();
    if (!code) continue;

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

/**
 * Главный билдер документа: собирает HTML-строку для iframe
 */
export function buildDocument({
  bodyHtml,
  fontEntries = [],
  defaultFont = "",
  classesCss = {},
  scriptsJs = {},
}: BuildDocumentParams): string {
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
  <script src="https://cdn.tailwindcss.com"></script>
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
  </script>

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
</script>`
    : ""
}
</body>
</html>`;
}

/* ==========================================================================
   4. РАБОТА С ХРАНИЛИЩЕМ (Data Access / LocalStorage)
   ========================================================================== */

export function loadPreviewSettings(): PreviewSettings {
  const result: PreviewSettings = {
    fonts: [],
    defaultFont: "",
    classesCss: {},
    scriptsJs: {},
  };

  if (typeof window === "undefined") return result;

  try {
    const savedFonts = localStorage.getItem(FONTS_STORAGE_KEY);
    if (savedFonts) {
      const parsed = JSON.parse(savedFonts);
      if (Array.isArray(parsed)) result.fonts = parsed;
    }
  } catch (e) {
    console.error("[previewModel] Failed to read fonts from localStorage:", e);
  }

  try {
    const savedDefault = localStorage.getItem(DEFAULT_FONT_STORAGE_KEY);
    if (savedDefault) result.defaultFont = savedDefault;
  } catch (e) {
    console.error(
      "[previewModel] Failed to read default font from localStorage:",
      e,
    );
  }

  try {
    const savedCss = localStorage.getItem(CLASSES_CSS_STORAGE_KEY);
    if (savedCss) {
      const parsed = JSON.parse(savedCss);
      if (parsed && typeof parsed === "object") result.classesCss = parsed;
    }
  } catch (e) {
    console.error(
      "[previewModel] Failed to read classes CSS from localStorage:",
      e,
    );
  }

  try {
    const savedJs = localStorage.getItem(SCRIPTS_STORAGE_KEY);
    if (savedJs) {
      const parsed = JSON.parse(savedJs);
      if (parsed && typeof parsed === "object") result.scriptsJs = parsed;
    }
  } catch (e) {
    console.error(
      "[previewModel] Failed to read scripts JS from localStorage:",
      e,
    );
  }

  return result;
}

export function saveFontsSettings(fonts: string[], defaultFont: string): void {
  try {
    localStorage.setItem(FONTS_STORAGE_KEY, JSON.stringify(fonts));
    localStorage.setItem(DEFAULT_FONT_STORAGE_KEY, defaultFont);
  } catch (err) {
    console.error("[previewModel] Failed to save fonts to localStorage:", err);
  }
}

/* ==========================================================================
   5. БИЗНЕС-ПРАВИЛА И МУТАЦИИ (Business Rules)
   ========================================================================== */

/**
 * Правило: добавить новый шрифт и назначить его дефолтным, если список был пуст
 */
export function addFont(
  fonts: string[],
  newFontInput: string,
  currentDefaultFont: string,
): FontMutationResult {
  const trimmed = newFontInput.trim();
  if (!trimmed || fonts.includes(trimmed)) {
    return { fonts, defaultFont: currentDefaultFont };
  }

  const nextFonts = [...fonts, trimmed];
  const detected = extractFontFamilies(nextFonts);

  let nextDefault = currentDefaultFont;
  if (!nextDefault && detected.length > 0) {
    nextDefault = detected[0];
  }

  saveFontsSettings(nextFonts, nextDefault);

  return {
    fonts: nextFonts,
    defaultFont: nextDefault,
  };
}

/**
 * Правило: удалить шрифт. Если удален дефолтный — переключить на оставшийся
 */
export function removeFont(
  fonts: string[],
  fontToRemove: string,
  currentDefaultFont: string,
): FontMutationResult {
  const nextFonts = fonts.filter((f) => f !== fontToRemove);
  const detected = extractFontFamilies(nextFonts);

  let nextDefault = currentDefaultFont;
  if (!detected.includes(currentDefaultFont)) {
    nextDefault = detected.length > 0 ? detected[0] : "";
  }

  saveFontsSettings(nextFonts, nextDefault);

  return {
    fonts: nextFonts,
    defaultFont: nextDefault,
  };
}

/**
 * Правило: переключить дефолтный шрифт (toggle)
 */
export function toggleDefaultFont(
  fonts: string[],
  currentDefaultFont: string,
  targetFont: string,
): string {
  const nextDefault = currentDefaultFont === targetFont ? "" : targetFont;
  saveFontsSettings(fonts, nextDefault);
  return nextDefault;
}
