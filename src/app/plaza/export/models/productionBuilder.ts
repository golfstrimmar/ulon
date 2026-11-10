/**
 * @file productionBuilder.ts
 * @description Собирает production-бандл: index.html + styles.css + scripts.js.
 * Всё происходит в браузере (IndexedDB → чистые файлы).
 */

import {
  getHtmlJson,
  getGlobalScss,
  getGlobalJs,
  getFontsSettings,
} from "@/lib/htmlStorage";
import { getColorVariables } from "@/lib/figmaColorStorage";
import { compileScssToCss } from "@/lib/scssCompiler";
import { purgeUnusedCss, type PurgeResult } from "@/lib/cssPurger";
import { deduplicateCss } from "@/lib/cssDeduper";
import {
  renderTree,
  extractFontFamilies,
  parseFontHeaderTag,
} from "@/app/plaza/components/PreviewArea/lib/previewModel";
import type { HtmlNode } from "@/types/HtmlNode";

const DB_KEY = "plaza_tree";

/* ============================================================================
   ТИПЫ
   ============================================================================ */

export interface BuildOptions {
  purge: boolean; // удалять неиспользуемые CSS-правила
  dedup: boolean; // дедуплицировать CSS-декларации
}

export interface ProductionBundle {
  html: string;
  css: string;
  js: string;
  /** Полный HTML для iframe-превью (css + js инлайн) */
  previewDoc: string;
  stats: {
    htmlBytes: number;
    cssBytes: number;
    jsBytes: number;
    htmlLines: number;
    cssLines: number;
    jsLines: number;
    cssRulesKept: number;
    cssRulesRemoved: number;
  };
}

/* ============================================================================
   HTML-ГЕНЕРАТОР
   ============================================================================ */

function buildProductionHtml({
  bodyHtml,
  fontEntries,
  defaultFont,
}: {
  bodyHtml: string;
  fontEntries: string[];
  defaultFont: string;
  colorVariables: string[];
}): string {
  const fontsHtml = fontEntries
    .map(parseFontHeaderTag)
    .filter(Boolean)
    .join("\n  ");

  const detectedFamilies = extractFontFamilies(fontEntries);

  const tailwindFamiliesObj = detectedFamilies
    .map((name) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      return `'${slug}': ["'${name}'", 'sans-serif']`;
    })
    .join(",\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/golfstrimmar/ulon-design-tokens@latest/colors.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/golfstrimmar/ulon-design-tokens@latest/typography.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/golfstrimmar/ulon-design-tokens@latest/null.css"/>
${fontsHtml ? "\n  " + fontsHtml : ""}
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

  <!-- Project styles -->
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="bg-white text-zinc-900">
${bodyHtml}

  <!-- Project scripts -->
  <script src="scripts.js"></script>
</body>
</html>`;
}

/* ============================================================================
   PREVIEW DOC ГЕНЕРАТОР (CSS + JS инлайн для iframe)
   ============================================================================ */

function buildPreviewDoc({
  bodyHtml,
  fontEntries,
  defaultFont,
  css,
  js,
}: {
  bodyHtml: string;
  fontEntries: string[];
  defaultFont: string;
  css: string;
  js: string;
}): string {
  const fontsHtml = fontEntries
    .map(parseFontHeaderTag)
    .filter(Boolean)
    .join("\n  ");

  const detectedFamilies = extractFontFamilies(fontEntries);

  const tailwindFamiliesObj = detectedFamilies
    .map((name) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      return `'${slug}': ["'${name}'", 'sans-serif']`;
    })
    .join(",\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/golfstrimmar/ulon-design-tokens@latest/colors.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/golfstrimmar/ulon-design-tokens@latest/typography.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/golfstrimmar/ulon-design-tokens@latest/null.css"/>
${fontsHtml ? "\n  " + fontsHtml : ""}
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
${css ? `\n  <style>\n${css}\n  </style>` : ""}
</head>
<body class="bg-white text-zinc-900">
${bodyHtml}
${js ? `\n<script>\n${js}\n</script>` : ""}
</body>
</html>`;
}

/* ============================================================================
   CSS-ГЕНЕРАТОР
   ============================================================================ */

async function buildProductionCss({
  rawScss,
  colorVariables,
  fontEntries,
  defaultFont,
  bodyHtml,
  purge,
  dedup,
}: {
  rawScss: string;
  colorVariables: string[];
  fontEntries: string[];
  defaultFont: string;
  bodyHtml: string;
  purge: boolean;
  dedup: boolean;
}): Promise<{ css: string; purgeResult: PurgeResult }> {
  const detectedFamilies = extractFontFamilies(fontEntries);

  // 1. Reset
  const reset = `/* === Reset === */
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #171717;
  ${defaultFont ? `font-family: '${defaultFont}', sans-serif;` : `font-family: Arial, Helvetica, sans-serif;`}
  min-height: 100%;
}`;

  // 2. Font helper classes
  const fontHelpers = detectedFamilies
    .map((name) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      return `.${slug}, .font-${slug} {\n  font-family: '${name}', sans-serif !important;\n}`;
    })
    .join("\n\n");

  // 3. Figma color variables → :root { --color: value; }
  const figmaVarsBlock = buildCssColorVariables(colorVariables);

  // 4. Compile SCSS → CSS
  const colorDefs = colorVariables.join("\n");
  const scssWithColors = colorDefs ? `${colorDefs}\n${rawScss}` : rawScss;
  const compiledScss = await compileScssToCss(scssWithColors);

  // 5. Собираем полный CSS
  let sections = [reset, figmaVarsBlock, fontHelpers, compiledScss]
    .filter(Boolean)
    .join("\n\n");

  // 6. Дедупликация (только compiled SCSS — reset/figma не трогаем)
  if (dedup && compiledScss.trim()) {
    const dedupedScss = deduplicateCss(compiledScss);
    sections = [reset, figmaVarsBlock, fontHelpers, dedupedScss]
      .filter(Boolean)
      .join("\n\n");
  }

  // 7. Purge
  let purgeResult: PurgeResult = { css: sections, kept: 0, removed: 0 };

  if (purge && bodyHtml.trim()) {
    purgeResult = purgeUnusedCss(bodyHtml, sections);
  } else {
    const counted = purgeUnusedCss(bodyHtml, sections);
    purgeResult = {
      css: sections,
      kept: counted.kept + counted.removed,
      removed: 0,
    };
  }

  return { css: purgeResult.css, purgeResult };
}

/** Превращает массив SCSS-переменных ($color: val) в CSS :root { --color: val; } */
function buildCssColorVariables(variables: string[]): string {
  if (!variables.length) return "";
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
      return null;
    })
    .filter(Boolean);

  if (!lines.length) return "";
  return `/* === Figma Color Variables === */\n:root {\n${lines.join("\n")}\n}`;
}

/* ============================================================================
   JS-ГЕНЕРАТОР
   ============================================================================ */

function buildProductionJs(rawJs: string): string {
  if (!rawJs.trim()) return "";
  return rawJs
    .replace(/\/\* --- \[script:[^\]]+\] --- \*\//g, "")
    .replace(/\/\* --- \[end:[^\]]+\] --- \*\//g, "")
    .replace(/\/\* --- Скрипт:[^*]+\*\//g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ============================================================================
   ГЛАВНАЯ ФУНКЦИЯ
   ============================================================================ */

export async function buildProductionBundle(
  options: BuildOptions = { purge: true, dedup: true },
): Promise<ProductionBundle> {
  const [rawTree, rawScss, rawJs, fontsData, colorVars] = await Promise.all([
    getHtmlJson(DB_KEY).catch(() => null),
    getGlobalScss().catch(() => ""),
    getGlobalJs().catch(() => ""),
    getFontsSettings().catch(() => ({ fonts: [], defaultFont: "" })),
    getColorVariables().catch(() => []),
  ]);

  const fontEntries: string[] = fontsData?.fonts || [];
  const defaultFont: string = fontsData?.defaultFont || "";
  const colorVariables: string[] = Array.isArray(colorVars)
    ? colorVars
    : Array.isArray((colorVars as any)?.variables)
      ? (colorVars as any).variables
      : [];

  // Body HTML из дерева нод
  let bodyHtml = "";
  if (rawTree) {
    const nodes: HtmlNode[] = Array.isArray(rawTree) ? rawTree : [rawTree];
    if (nodes.length > 0) bodyHtml = renderTree(nodes);
  }

  // CSS
  const { css, purgeResult } = await buildProductionCss({
    rawScss: rawScss || "",
    colorVariables,
    fontEntries,
    defaultFont,
    bodyHtml,
    purge: options.purge,
    dedup: options.dedup,
  });

  // HTML (ссылается на styles.css и scripts.js)
  const html = buildProductionHtml({
    bodyHtml,
    fontEntries,
    defaultFont,
    colorVariables,
  });

  // JS
  const js = buildProductionJs(rawJs || "");

  // Preview doc (всё инлайн — для iframe на странице экспорта)
  const previewDoc = buildPreviewDoc({
    bodyHtml,
    fontEntries,
    defaultFont,
    css,
    js,
  });

  // Статистика
  const enc = (s: string) => new TextEncoder().encode(s).length;
  const lines = (s: string) => (s.trim() ? s.split("\n").length : 0);

  return {
    html,
    css,
    js,
    previewDoc,
    stats: {
      htmlBytes: enc(html),
      cssBytes: enc(css),
      jsBytes: enc(js),
      htmlLines: lines(html),
      cssLines: lines(css),
      jsLines: lines(js),
      cssRulesKept: purgeResult.kept,
      cssRulesRemoved: purgeResult.removed,
    },
  };
}
