import {
  escapeRegex,
  extractClassSnippet,
  updateNestedSnippetInClass,
  updateClassInGlobalScss,
} from "@/lib/scssCompiler";
import { splitTopLevelCssBlocks } from "@/app/plaza/components/CanvasArea/models/canvasModel";

/**
 * 🔹 Extracts snippet with fallback to inline style if SCSS block is empty
 */
export function getSnippetWithFallback(
  cls: string | null,
  scss: string,
  fallbackStyle?: string,
): string {
  if (!cls) return "";
  const extracted = extractClassSnippet(scss, cls);
  const isEmpty =
    !extracted ||
    extracted.trim() === `.${cls} {\n  \n}` ||
    extracted.trim() === `.${cls} {}` ||
    extracted.trim() === `.${cls} {\n}`;

  if (isEmpty && fallbackStyle && fallbackStyle.trim()) {
    const trimmed = fallbackStyle.trim();
    if (trimmed.includes("{")) {
      return `.${cls} {\n  ${trimmed.split("\n").join("\n  ")}\n}`;
    }
    const formatted = trimmed
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `  ${s};`)
      .join("\n");
    if (formatted) {
      return `.${cls} {\n${formatted}\n}`;
    }
  }

  return extracted;
}

/**
 * 🔹 Combines snippets for all classes into a single multi-class SCSS text (Browser DevTools style)
 */
export function buildAllClassesSnippet(
  classes: string[],
  scss: string,
  fallbackStyle?: string,
): string {
  const uniqueClasses = Array.from(
    new Set(classes.map((c) => c.trim().replace(/^\./, "")).filter(Boolean)),
  );
  if (uniqueClasses.length === 0) return "";

  return uniqueClasses
    .map((cls, idx) => {
      const fb = idx === 0 ? fallbackStyle : undefined;
      return getSnippetWithFallback(cls, scss, fb);
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 🔹 Guarantees that code is wrapped inside .className { ... } selector
 */
export function ensureSelectorWrapper(className: string, code: string): string {
  const cls = className.trim().replace(/^\./, "");
  const trimmed = (code || "").trim();
  if (!cls) return trimmed;
  if (!trimmed) return `.${cls} {\n  \n}`;

  const escaped = escapeRegex(cls);
  const regex = new RegExp(`^\\.${escaped}(?![a-zA-Z0-9_.-])`);
  if (regex.test(trimmed)) {
    return trimmed;
  }

  return `.${cls} {\n  ${trimmed
    .split("\n")
    .map((l) => (l.trim() ? `  ${l}` : ""))
    .join("\n")}\n}`;
}

/**
 * 🔹 Updates global SCSS from multi-class editor text
 */
export function updateGlobalScssFromMultiClass(
  currentGlobalScss: string,
  multiClassText: string,
  nodeClasses: string[],
): string {
  let nextScss = currentGlobalScss;
  const blocks = splitTopLevelCssBlocks(multiClassText);
  const processedClasses = new Set<string>();

  const cleanNodeClasses = nodeClasses
    .map((c) => c.trim().replace(/^\./, ""))
    .filter(Boolean);

  for (const block of blocks) {
    // Определяем целевой класс для этого блока:
    // 1. Если среди классов селектора есть класс текущей ноды — выбираем его
    // 2. Иначе берем первый класс селектора
    // 3. Либо парсим селектор .className
    let targetClass: string | null = null;
    if (block.classes.length > 0) {
      targetClass =
        block.classes.find((c) => cleanNodeClasses.includes(c)) ||
        block.classes[0];
    } else if (block.selector.startsWith(".")) {
      targetClass = block.selector.replace(/^\./, "").trim();
    }

    if (targetClass) {
      processedClasses.add(targetClass);
      nextScss = updateClassInGlobalScss(nextScss, targetClass, block.full);
    }
  }

  // Если какой-то класс был полностью очищен из текста редактора
  for (const rawCls of nodeClasses) {
    const cls = rawCls.trim().replace(/^\./, "");
    if (
      cls &&
      !processedClasses.has(cls) &&
      !multiClassText.includes(`.${cls}`)
    ) {
      nextScss = updateClassInGlobalScss(nextScss, cls, "");
    }
  }

  return nextScss;
}

/**
 * 🔹 Cleans mutually exclusive and conflicting CSS properties:
 * - padding vs padding-top/bottom/left/right
 * - margin vs margin-top/bottom/left/right
 * - gap vs row-gap/column-gap
 * - grid vs flex properties
 */
export function cleanConflictingProperties(
  existingCss: string,
  newSnippet: string,
): string {
  const newPropertyNames: string[] = [];
  const propRegex = /([a-zA-Z0-9_-]+)\s*:/g;
  let match: RegExpExecArray | null;

  while ((match = propRegex.exec(newSnippet)) !== null) {
    newPropertyNames.push(match[1].toLowerCase());
  }

  if (newPropertyNames.includes("padding")) {
    newPropertyNames.push(
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
    );
  }

  if (newPropertyNames.includes("margin")) {
    newPropertyNames.push(
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
    );
  }

  if (newPropertyNames.some((p) => p.startsWith("padding-"))) {
    newPropertyNames.push("padding");
  }

  if (newPropertyNames.some((p) => p.startsWith("margin-"))) {
    newPropertyNames.push("margin");
  }

  if (newPropertyNames.includes("gap")) {
    newPropertyNames.push("row-gap", "column-gap");
  }

  if (
    newPropertyNames.includes("row-gap") ||
    newPropertyNames.includes("column-gap")
  ) {
    newPropertyNames.push("gap");
  }

  if (newSnippet.includes("display: grid")) {
    newPropertyNames.push("flex-direction", "flex-wrap");
  }

  if (newSnippet.includes("display: flex")) {
    newPropertyNames.push(
      "grid-template-columns",
      "grid-template-rows",
      "grid-auto-flow",
    );
  }

  let lines = existingCss.split("\n");

  lines = lines.filter((line) => {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith(".") ||
      trimmed.startsWith("&") ||
      trimmed === "}"
    ) {
      return true;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex !== -1) {
      const propName = trimmed.slice(0, colonIndex).trim().toLowerCase();
      if (newPropertyNames.includes(propName)) {
        return false;
      }
    }
    return true;
  });

  return lines.join("\n");
}

/**
 * 🔹 Applies a CSS/SCSS snippet (rules, pseudo-elements, @media) to the current class body
 */
export function applySnippetToClassCss(
  className: string,
  currentCssText: string,
  snippetCss: string,
): string {
  let text = currentCssText.trim();
  const trimmedSnippet = snippetCss.trim();

  // 1. Full class replacement
  if (trimmedSnippet.startsWith(`.${className}`)) {
    return trimmedSnippet;
  }

  // 2. Pseudo-selectors (&:hover, &:before) or media queries (@media ...)
  if (trimmedSnippet.startsWith("&") || trimmedSnippet.startsWith("@media")) {
    let nestedSelector: string | null = null;
    if (trimmedSnippet.startsWith("&")) {
      const match = trimmedSnippet.match(/^(&[:a-zA-Z0-9_()-]+)/);
      nestedSelector = match ? match[1] : null;
    } else if (trimmedSnippet.startsWith("@media")) {
      const match = trimmedSnippet.match(/^(@media[^{]+)/);
      nestedSelector = match ? match[1].trim() : null;
    }

    if (
      !text ||
      text === `.${className} {\n  \n}` ||
      text === `.${className} {}`
    ) {
      return `.${className} {\n  ${trimmedSnippet.split("\n").join("\n  ")}\n}`;
    }

    if (nestedSelector) {
      return updateNestedSnippetInClass(text, nestedSelector, trimmedSnippet);
    }

    const lastBraceIndex = text.lastIndexOf("}");
    if (lastBraceIndex !== -1) {
      const before = text.slice(0, lastBraceIndex).trimEnd();
      return `${before}\n\n  ${trimmedSnippet.split("\n").join("\n  ")}\n}`;
    }
    return `${text}\n  ${trimmedSnippet}`;
  }

  // 3. Regular CSS properties (remove conflicts, append cleanly)
  if (text) {
    text = cleanConflictingProperties(text, snippetCss);
  }

  if (
    !text ||
    text === `.${className} {\n  \n}` ||
    text === `.${className} {}`
  ) {
    return `.${className} {\n  ${snippetCss}\n}`;
  }

  if (text.endsWith("}")) {
    const lastBraceIndex = text.lastIndexOf("}");
    const before = text.slice(0, lastBraceIndex).trimEnd();
    return `${before}\n  ${snippetCss.split("\n").join("\n  ")}\n}`;
  }

  return `${text}\n  ${snippetCss}`;
}
