/**
 * @file scssCompiler.ts
 * @description Компиляция SCSS в CSS и обновление конкретного класса на месте.
 */

import { compileScssAction } from "@/actions/scss.actions";

export async function compileScssToCss(scss: string): Promise<string> {
  const code = (scss || "").trim();
  if (!code) return "";

  try {
    // 🚀 Прямой вызов серверного экшена без всяких fetch('/api/compile-scss')!
    const res = await compileScssAction(code);
    if (res.success && res.css !== undefined) {
      return res.css;
    }
  } catch (e) {
    console.warn("⚠️ [SCSS Action Network Error]:", e.message);
  }

  return code;
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

  const regex = new RegExp(`(^|\\n)[ \\t]*\\.${cls}\\b[^{]*\\{`);
  const match = regex.exec(globalScss);
  if (!match) {
    return `.${cls} {\n  \n}`;
  }

  const startIdx = match.index + (match[1] ? match[1].length : 0);
  const openBraceIdx = globalScss.indexOf("{", startIdx);
  if (openBraceIdx === -1) return `.${cls} {\n  \n}`;

  let braceCount = 1;
  let pos = openBraceIdx + 1;
  const len = globalScss.length;

  while (pos < len && braceCount > 0) {
    if (globalScss[pos] === "{") braceCount++;
    else if (globalScss[pos] === "}") braceCount--;
    pos++;
  }

  return globalScss.slice(startIdx, pos).trim();
}

/**
 * Заменяет найденный блок .cls { ... } на новый. Если его нет — дописывает в конец.
 */
export function updateClassInGlobalScss(
  globalScss: string,
  className: string,
  newSnippet: string,
): string {
  const cls = className.trim().replace(/^\./, "");
  if (!cls) return globalScss;

  const trimmedSnippet = newSnippet.trim();

  // Ищем блок этого класса
  const regex = new RegExp(`(^|\\n)([ \\t]*\\.${cls}\\b[^{]*\\{)`);
  const match = regex.exec(globalScss);

  if (match) {
    const fullMatchStart = match.index + (match[1] ? match[1].length : 0);
    const braceStart = globalScss.indexOf("{", fullMatchStart);

    if (braceStart !== -1) {
      let braceCount = 1;
      let pos = braceStart + 1;
      const len = globalScss.length;

      while (pos < len && braceCount > 0) {
        if (globalScss[pos] === "{") braceCount++;
        else if (globalScss[pos] === "}") braceCount--;
        pos++;
      }

      // Заменяем строго этот найденный фрагмент
      const before = globalScss.slice(0, fullMatchStart);
      const after = globalScss.slice(pos);

      if (!trimmedSnippet) {
        return (before + after).trim();
      }

      return (before + trimmedSnippet + after).trim();
    }
  }

  // Если класса не было в файле — дописываем в конец
  if (!trimmedSnippet) return globalScss;
  return globalScss.trim()
    ? `${globalScss.trim()}\n\n${trimmedSnippet}`
    : trimmedSnippet;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  let braceCount = 1;
  let pos = openBrace + 1;
  const len = classSnippet.length;

  while (pos < len && braceCount > 0) {
    if (classSnippet[pos] === "{") braceCount++;
    else if (classSnippet[pos] === "}") braceCount--;
    pos++;
  }

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
      let braceCount = 1;
      let pos = braceStart + 1;
      const len = classSnippet.length;

      while (pos < len && braceCount > 0) {
        if (classSnippet[pos] === "{") braceCount++;
        else if (classSnippet[pos] === "}") braceCount--;
        pos++;
      }

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

  // Если вложенного блока ещё не было — вставляем перед закрывающей скобкой класса }
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
