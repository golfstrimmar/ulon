import type { HtmlNode } from "@/types/HtmlNode";
import { treeToHtml } from "@/lib/htmlTree";
import { compileClassesCss } from "@/lib/cssCompiler";
import { prepareScriptsForExecution } from "@/lib/jsCompiler";

import { getFontsSettings, saveFontsSettings } from "@/lib/htmlStorage";

/* ==========================================================================
   1. СХЕМЫ ДАННЫХ
   ========================================================================== */

export interface PreviewSettings {
  fonts: string[];
  defaultFont: string;
  scriptsJs: Record<string, string>;
}

export interface BuildDocumentParams {
  bodyHtml: string;
  fontEntries?: string[];
  defaultFont?: string;
  globalCss?: string;
  globalJs?: string;
  classesCss?: Record<string, string>;
  scriptsJs?: Record<string, string>;
}

export interface FontMutationResult {
  fonts: string[];
  defaultFont: string;
}

/* ==========================================================================
   2. КОНСТАНТЫ
   ========================================================================== */

export const DB_KEY = "plaza_tree";

/* ==========================================================================
   3. ПАРСИНГ И ТРАНСФОРМАЦИЯ
   ========================================================================== */

export function renderTree(nodes: HtmlNode[]): string {
  return nodes.map((n) => treeToHtml(n, 0)).join("\n");
}

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

export function buildDocument({
  bodyHtml,
  fontEntries = [],
  defaultFont = "",
  globalCss = "",
  globalJs = "",
  classesCss = {},
  scriptsJs = {},
}: BuildDocumentParams): string {
  const fontsHtml = fontEntries
    .map(parseFontHeaderTag)
    .filter(Boolean)
    .join("\n  ");

  const detectedFamilies = extractFontFamilies(fontEntries);

  const compiledClassesStyles = globalCss || "";

  const rawJs =
    globalJs || scriptsJs.__bundle__ || Object.values(scriptsJs).join("\n\n");

  const compiledBundleScripts = prepareScriptsForExecution(rawJs);

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
       ? `<!-- Скомпилированный SCSS в чистый CSS -->
   <style id="compiled-classes-styles">
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
 ${compiledBundleScripts}
 </script>`
     : ""
 }
 </body>
 </html>`;
}

/* ==========================================================================
   4. РАБОТА С INDEXEDDB
   ========================================================================== */

export async function loadPreviewSettings(): Promise<PreviewSettings> {
  const result: PreviewSettings = {
    fonts: [],
    defaultFont: "",
    scriptsJs: {},
  };

  try {
    const fontsSettings = await getFontsSettings();

    result.fonts = fontsSettings.fonts || [];
    result.defaultFont = fontsSettings.defaultFont || "";
  } catch (error) {
    console.error("[previewModel] Failed to load fonts settings:", error);
  }

  return result;
}

/* ==========================================================================
   5. БИЗНЕС-ПРАВИЛА И МУТАЦИИ
   ========================================================================== */

export async function addFont(
  fonts: string[],
  newFontInput: string,
  currentDefaultFont: string,
): Promise<FontMutationResult> {
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

  await saveFontsSettings({
    fonts: nextFonts,
    defaultFont: nextDefault,
  });

  return {
    fonts: nextFonts,
    defaultFont: nextDefault,
  };
}

export async function removeFont(
  fonts: string[],
  fontToRemove: string,
  currentDefaultFont: string,
): Promise<FontMutationResult> {
  const nextFonts = fonts.filter((font) => font !== fontToRemove);
  const detected = extractFontFamilies(nextFonts);

  let nextDefault = currentDefaultFont;

  if (!detected.includes(currentDefaultFont)) {
    nextDefault = detected.length > 0 ? detected[0] : "";
  }

  await saveFontsSettings({
    fonts: nextFonts,
    defaultFont: nextDefault,
  });

  return {
    fonts: nextFonts,
    defaultFont: nextDefault,
  };
}

export async function toggleDefaultFont(
  fonts: string[],
  currentDefaultFont: string,
  targetFont: string,
): Promise<string> {
  const nextDefault = currentDefaultFont === targetFont ? "" : targetFont;

  await saveFontsSettings({
    fonts,
    defaultFont: nextDefault,
  });

  return nextDefault;
}
