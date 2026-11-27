/**
 * @file figmaCssUtils.ts
 * @description Утилиты для парсинга CSS/SCSS деклараций, выделения общей базы шрифта
 * и вычисления дельты (диффа) свойств между классами.
 */

import { extractClassSnippet } from "@/lib/scssCompiler";

export const FONT_BASE_PROPERTIES = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
]);

/**
 * Парсит строку CSS свойств (или блок { ... }) в Map<prop, val>.
 */
export function parseCssDeclarations(cssText: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!cssText || !cssText.trim()) return map;

  let content = cssText.trim();

  // Если это полный блок с фигурными скобками селектора
  const openBraceIdx = content.indexOf("{");
  if (openBraceIdx !== -1) {
    const closeBraceIdx = content.lastIndexOf("}");
    content = content.slice(
      openBraceIdx + 1,
      closeBraceIdx !== -1 ? closeBraceIdx : undefined,
    );
  }

  const statements = content.split(";");
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }
    // Если это вложенный блок правил, пропускаем его из плоских свойств
    if (trimmed.includes("{")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx !== -1) {
      const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (prop && val) {
        map.set(prop, val);
      }
    }
  }

  return map;
}

/**
 * Превращает Map<prop, val> обратно в форматированное тело CSS (с отступами и точкой с запятой).
 */
export function formatCssDeclarations(
  props: Map<string, string>,
  indent = "  ",
): string {
  const lines: string[] = [];
  for (const [prop, val] of props.entries()) {
    lines.push(`${indent}${prop}: ${val};`);
  }
  return lines.join("\n");
}

/**
 * Генерирует имя класса для общей базы шрифта.
 * Например: font-16-400, font-24-700.
 */
export function getFontBaseClassName(params: {
  fontSize?: number | string;
  fontWeight?: number | string;
}): string {
  const size = Math.round(Number(params.fontSize) || 16);
  const weight = Math.round(Number(params.fontWeight) || 400);
  return `font-${size}-${weight}`;
}

/**
 * Разделяет набор свойств на базу шрифта (font-*) и свойства конкретного элемента (color, text-align, etc.).
 */
export function splitStylesIntoFontAndElement(props: Map<string, string>): {
  fontProps: Map<string, string>;
  elementProps: Map<string, string>;
} {
  const fontProps = new Map<string, string>();
  const elementProps = new Map<string, string>();

  for (const [prop, val] of props.entries()) {
    if (FONT_BASE_PROPERTIES.has(prop)) {
      fontProps.set(prop, val);
    } else {
      elementProps.set(prop, val);
    }
  }

  return { fontProps, elementProps };
}

/**
 * Вычисляет дельту свойств: те свойства targetProps, которых нет в baseProps
 * или значение которых отличается.
 */
export function computeCssPropertiesDiff(
  baseProps: Map<string, string>,
  targetProps: Map<string, string>,
): Map<string, string> {
  const diff = new Map<string, string>();

  for (const [prop, val] of targetProps.entries()) {
    const baseVal = baseProps.get(prop);
    if (
      baseVal === undefined ||
      baseVal.trim().toLowerCase() !== val.trim().toLowerCase()
    ) {
      diff.set(prop, val);
    }
  }

  return diff;
}

/**
 * Извлекает свойства указанного класса из глобального SCSS бандла.
 */
export function extractClassPropertiesFromScss(
  globalScss: string,
  className: string,
): Map<string, string> {
  if (!globalScss || !className) return new Map();
  const snippet = extractClassSnippet(globalScss, className);
  return parseCssDeclarations(snippet);
}
