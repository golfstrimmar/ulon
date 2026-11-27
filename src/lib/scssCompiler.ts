/**
 * @file scssCompiler.ts
 * @description Компиляция SCSS в CSS и обновление конкретного класса на месте.
 */

import { compileScssAction } from "@/actions/scss.actions";

export async function compileScssToCss(scss: string): Promise<string> {
  const code = (scss || "").trim();
  if (!code) return "";

  try {
    const res = await compileScssAction(code);
    if (res.success && res.css !== undefined) {
      return res.css;
    }
  } catch (e) {
    console.warn("⚠️ [SCSS Action Network Error]:", (e as any)?.message);
  }

  return code;
}

function findMatchingBraceEnd(source: string, openBraceIdx: number): number {
  let braceCount = 1;
  let pos = openBraceIdx + 1;
  const len = source.length;

  while (pos < len && braceCount > 0) {
    if (source[pos] === "{") braceCount++;
    else if (source[pos] === "}") braceCount--;
    pos++;
  }

  return pos;
}

/**
 * Находит и возвращает блок класса из глобального SCSS
 */
export function extractClassSnippet(
  globalScss: string,
  className: string,
): string {
  const cls = className.trim().replace(/^\./, "");
  if (!globalScss || !cls) return `.${cls} {\n  \n}`;

  const escaped = escapeRegex(cls);

  // 1. Сначала ищем ТОП-ЛЕВЕЛ селектор на нулевой вложенности (без пробелов в начале строки)
  const topLevelRegex = new RegExp(`(^|\\n)(\\.${escaped}\\s*\\{)`);
  let match = topLevelRegex.exec(globalScss);

  // 2. Если нет точного, ищем топ-левел с селекторами/псевдоклассами
  if (!match) {
    const topLevelLoose = new RegExp(
      `(^|\\n)(\\.${escaped}(?![a-zA-Z0-9_.-])[^{]*\\{)`,
    );
    match = topLevelLoose.exec(globalScss);
  }

  // 3. И только если топ-левел блока нет, ищем вложенное правило
  if (!match) {
    const nestedRegex = new RegExp(`(^|\\n)([ \\t]+\\.${escaped}\\s*\\{)`);
    match = nestedRegex.exec(globalScss);
  }
  if (!match) {
    const fallbackRegex = new RegExp(
      `(^|\\n)[ \\t]+\\.${escaped}(?![a-zA-Z0-9_.-])[^{]*\\{`,
    );
    match = fallbackRegex.exec(globalScss);
  }
  if (!match) {
    return `.${cls} {\n  \n}`;
  }

  const startIdx = match.index + (match[1] ? match[1].length : 0);
  const openBraceIdx = globalScss.indexOf("{", startIdx);
  if (openBraceIdx === -1) return `.${cls} {\n  \n}`;

  const endIdx = findMatchingBraceEnd(globalScss, openBraceIdx);
  return globalScss.slice(startIdx, endIdx).trim();
}

/**
 * Заменяет найденный блок .cls { ... } на новый и удаляет дубли того же точного класса ниже.
 * Если класса нет — дописывает в конец.
 */
export function updateClassInGlobalScss(
  globalScss: string,
  className: string,
  newSnippet: string,
): string {
  const cls = className.trim().replace(/^\./, "");
  if (!cls) return globalScss;

  const trimmedSnippet = newSnippet.trim();
  const escaped = escapeRegex(cls);

  // Сначала ищем топ-левел селекторы без отступов
  const topLevelRegex = new RegExp(`(^|\\n)(\\.${escaped}\\s*\\{)`, "g");
  let exactRanges: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = topLevelRegex.exec(globalScss)) !== null) {
    const start = match.index + (match[1] ? match[1].length : 0);
    const braceStart = globalScss.indexOf("{", start);
    if (braceStart === -1) break;
    const end = findMatchingBraceEnd(globalScss, braceStart);
    exactRanges.push({ start, end });
    topLevelRegex.lastIndex = end;
  }

  // Если топ-левела нет, ищем вложенные
  if (exactRanges.length === 0) {
    const exactRegex = new RegExp(`(^|\\n)([ \\t]*\\.${escaped}\\s*\\{)`, "g");
    while ((match = exactRegex.exec(globalScss)) !== null) {
      const start = match.index + (match[1] ? match[1].length : 0);
      const braceStart = globalScss.indexOf("{", start);
      if (braceStart === -1) break;
      const end = findMatchingBraceEnd(globalScss, braceStart);
      exactRanges.push({ start, end });
      exactRegex.lastIndex = end;
    }
  }

  if (exactRanges.length > 0) {
    let result = "";
    let cursor = 0;

    exactRanges.forEach((range, idx) => {
      result += globalScss.slice(cursor, range.start);
      if (idx === 0 && trimmedSnippet) {
        result += trimmedSnippet;
      }
      cursor = range.end;
    });
    result += globalScss.slice(cursor);

    return result.replace(/\n{3,}/g, "\n\n").trim();
  }

  const fallbackRegex = new RegExp(
    `(^|\\n)([ \\t]*\\.${escaped}(?![a-zA-Z0-9_.-])[^{]*\\{)`,
  );
  const fallbackMatch = fallbackRegex.exec(globalScss);

  if (fallbackMatch) {
    const fullMatchStart =
      fallbackMatch.index + (fallbackMatch[1] ? fallbackMatch[1].length : 0);
    const braceStart = globalScss.indexOf("{", fullMatchStart);

    if (braceStart !== -1) {
      const pos = findMatchingBraceEnd(globalScss, braceStart);
      const before = globalScss.slice(0, fullMatchStart);
      const after = globalScss.slice(pos);

      if (!trimmedSnippet) {
        return (before + after).replace(/\n{3,}/g, "\n\n").trim();
      }

      return (before + trimmedSnippet + after).trim();
    }
  }

  if (!trimmedSnippet) return globalScss;
  return globalScss.trim()
    ? `${globalScss.trim()}\n\n${trimmedSnippet}`
    : trimmedSnippet;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasClassInScss(globalScss: string, className: string): boolean {
  const cls = className.trim().replace(/^\./, "");
  if (!globalScss || !cls) return false;
  const escaped = escapeRegex(cls);
  const regex = new RegExp(
    `(^|\\n)[ \\t]*\\.${escaped}(?![a-zA-Z0-9_.-])[^{]*\\{`,
  );
  return regex.test(globalScss);
}

/**
 * Извлекает вложенный блок (например, &:before, &:hover) из текста класса .cls { ... }
 */
export function extractNestedSnippet(
  classSnippet: string,
  nestedSelector: string,
): string | null {
  if (!classSnippet || !nestedSelector) return null;
  const escaped = escapeRegex(nestedSelector.trim());
  const regex = new RegExp(
    `(^|\\n)[ \\t]*(${escaped})(?:\\b|(?=[\\s{]))[^{]*\\{`,
  );
  const match = regex.exec(classSnippet);
  if (!match) return null;

  const fullMatchStart = match.index + (match[1] ? match[1].length : 0);
  const openBrace = classSnippet.indexOf("{", fullMatchStart);
  if (openBrace === -1) return null;

  const pos = findMatchingBraceEnd(classSnippet, openBrace);
  return classSnippet.slice(fullMatchStart, pos).trim();
}

function mergeNestedBody(existingBody: string, newBody: string): string {
  const newProps = new Set<string>();
  const regex = /([a-zA-Z0-9_-]+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(newBody)) !== null) {
    newProps.add(m[1].toLowerCase());
  }

  const keptLines = existingBody
    .split("\n")
    .map((l) => l.trim())
    .filter((line) => {
      if (!line || line === "{" || line === "}") return false;
      const colon = line.indexOf(":");
      if (colon !== -1) {
        const prop = line.slice(0, colon).trim().toLowerCase();
        if (newProps.has(prop)) return false;
      }
      return true;
    });

  const newLines = newBody
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && l !== "{" && l !== "}");

  return [...keptLines, ...newLines].map((l) => `    ${l}`).join("\n");
}

/**
 * Обновляет или добавляет вложенный псевдо-блок (например, &:before { ... })
 * внутри блока класса .cls { ... }
 */
export function updateNestedSnippetInClass(
  classSnippet: string,
  nestedSelector: string,
  newNestedSnippet: string,
): string {
  const sel = nestedSelector.trim();
  if (!sel) return classSnippet;

  const trimmedSnippet = newNestedSnippet.trim();
  const escaped = escapeRegex(sel);
  const regex = new RegExp(
    `(^|\\n)([ \\t]*${escaped}(?:\\b|(?=[\\s{]))[^{]*\\{)`,
  );
  const match = regex.exec(classSnippet);

  if (match) {
    const fullMatchStart = match.index + (match[1] ? match[1].length : 0);
    const braceStart = classSnippet.indexOf("{", fullMatchStart);

    if (braceStart !== -1) {
      const pos = findMatchingBraceEnd(classSnippet, braceStart);

      const before = classSnippet.slice(0, fullMatchStart);
      const after = classSnippet.slice(pos);

      if (!trimmedSnippet) {
        return (before + after).trim();
      }

      const existingBody = classSnippet.slice(braceStart + 1, pos - 1);
      const newOpenBrace = trimmedSnippet.indexOf("{");
      const newCloseBrace = trimmedSnippet.lastIndexOf("}");
      const newBody =
        newOpenBrace !== -1 && newCloseBrace > newOpenBrace
          ? trimmedSnippet.slice(newOpenBrace + 1, newCloseBrace)
          : trimmedSnippet;

      const mergedBody = mergeNestedBody(existingBody, newBody);
      const formatted = `  ${sel} {\n${mergedBody}\n  }`;

      return `${before.trimEnd()}\n${formatted}\n${after.trimStart()}`.trim();
    }
  }

  if (!trimmedSnippet) return classSnippet;

  const formatted = trimmedSnippet
    .split("\n")
    .map((l) => (l.trim() ? `  ${l}` : ""))
    .join("\n");

  const lastBrace = classSnippet.lastIndexOf("}");
  if (lastBrace !== -1) {
    const before = classSnippet.slice(0, lastBrace).trimEnd();
    return `${before}\n\n${formatted}\n}`;
  }

  return `${classSnippet.trim()}\n\n${formatted}`;
}

export function compileClassesCss(): string {
  return "";
}
