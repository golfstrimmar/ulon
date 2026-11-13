/**
 * @file scssCompiler.ts
 * @description ÐšÐ¾Ð¼Ð¿Ð¸Ð»ÑÑ†Ð¸Ñ SCSS Ð² CSS Ð¸ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ ÐºÐ¾Ð½ÐºÑ€ÐµÑ‚Ð½Ð¾Ð³Ð¾ ÐºÐ»Ð°ÑÑÐ° Ð½Ð° Ð¼ÐµÑÑ‚Ðµ.
 */

import { compileScssAction } from "@/actions/scss.actions";

export async function compileScssToCss(scss: string): Promise<string> {
  const code = (scss || "").trim();
  if (!code) return "";

  try {
    // ðŸš€ ÐŸÑ€ÑÐ¼Ð¾Ð¹ Ð²Ñ‹Ð·Ð¾Ð² ÑÐµÑ€Ð²ÐµÑ€Ð½Ð¾Ð³Ð¾ ÑÐºÑˆÐµÐ½Ð° Ð±ÐµÐ· Ð²ÑÑÐºÐ¸Ñ… fetch('/api/compile-scss')!
    const res = await compileScssAction(code);
    if (res.success && res.css !== undefined) {
      return res.css;
    }
  } catch (e) {
    console.warn("âš ï¸ [SCSS Action Network Error]:", (e as any)?.message);
  }

  return code;
}

/**
 * ÐÐ°Ñ…Ð¾Ð´Ð¸Ñ‚ Ð¸ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ Ð±Ð»Ð¾Ðº ÐºÐ»Ð°ÑÑÐ° Ð¸Ð· Ð³Ð»Ð¾Ð±Ð°Ð»ÑŒÐ½Ð¾Ð³Ð¾ SCSS
 */
export function extractClassSnippet(
  globalScss: string,
  className: string,
): string {
  const cls = className.trim().replace(/^\./, "");
  if (!globalScss || !cls) return `.${cls} {\n  \n}`;

  const escaped = escapeRegex(cls);
  const exactRegex = new RegExp(`(^|\\n)([ \\t]*\\.${escaped}\\s*\\{)`);
  let match = exactRegex.exec(globalScss);
  if (!match) {
    const fallbackRegex = new RegExp(
      `(^|\\n)[ \\t]*\\.${escaped}(?![a-zA-Z0-9_.-])[^{]*\\{`,
    );
    match = fallbackRegex.exec(globalScss);
  }
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
 * Ð—Ð°Ð¼ÐµÐ½ÑÐµÑ‚ Ð½Ð°Ð¹Ð´ÐµÐ½Ð½Ñ‹Ð¹ Ð±Ð»Ð¾Ðº .cls { ... } Ð½Ð° Ð½Ð¾Ð²Ñ‹Ð¹. Ð•ÑÐ»Ð¸ ÐµÐ³Ð¾ Ð½ÐµÑ‚ â€” Ð´Ð¾Ð¿Ð¸ÑÑ‹Ð²Ð°ÐµÑ‚ Ð² ÐºÐ¾Ð½ÐµÑ†.
 */
export function updateClassInGlobalScss(
  globalScss: string,
  className: string,
  newSnippet: string,
): string {
  const cls = className.trim().replace(/^\./, "");
  if (!cls) return globalScss;

  const trimmedSnippet = newSnippet.trim();

  // Ð˜Ñ‰ÐµÐ¼ Ð±Ð»Ð¾Ðº ÑÑ‚Ð¾Ð³Ð¾ ÐºÐ»Ð°ÑÑÐ°
  // Ищем блок этого класса: сначала точный блок .className { ... }
  const escaped = escapeRegex(cls);
  const exactRegex = new RegExp(
    `(^|\\n)([ \\t]*\\.${escaped}\\s*\\{)`,
  );
  let match = exactRegex.exec(globalScss);
  if (!match) {
    const fallbackRegex = new RegExp(
      `(^|\\n)([ \\t]*\\.${escaped}(?![a-zA-Z0-9_.-])[^{]*\\{)`,
    );
    match = fallbackRegex.exec(globalScss);
  }

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

      // Ð—Ð°Ð¼ÐµÐ½ÑÐµÐ¼ ÑÑ‚Ñ€Ð¾Ð³Ð¾ ÑÑ‚Ð¾Ñ‚ Ð½Ð°Ð¹Ð´ÐµÐ½Ð½Ñ‹Ð¹ Ñ„Ñ€Ð°Ð³Ð¼ÐµÐ½Ñ‚
      const before = globalScss.slice(0, fullMatchStart);
      const after = globalScss.slice(pos);

      if (!trimmedSnippet) {
        return (before + after).trim();
      }

      return (before + trimmedSnippet + after).trim();
    }
  }

  // Ð•ÑÐ»Ð¸ ÐºÐ»Ð°ÑÑÐ° Ð½Ðµ Ð±Ñ‹Ð»Ð¾ Ð² Ñ„Ð°Ð¹Ð»Ðµ â€” Ð´Ð¾Ð¿Ð¸ÑÑ‹Ð²Ð°ÐµÐ¼ Ð² ÐºÐ¾Ð½ÐµÑ†
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
 * Ð˜Ð·Ð²Ð»ÐµÐºÐ°ÐµÑ‚ Ð²Ð»Ð¾Ð¶ÐµÐ½Ð½Ñ‹Ð¹ Ð±Ð»Ð¾Ðº (Ð½Ð°Ð¿Ñ€Ð¸Ð¼ÐµÑ€, &:before, &:hover) Ð¸Ð· Ñ‚ÐµÐºÑÑ‚Ð° ÐºÐ»Ð°ÑÑÐ° .cls { ... }
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
 * ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÑ‚ Ð¸Ð»Ð¸ Ð´Ð¾Ð±Ð°Ð²Ð»ÑÐµÑ‚ Ð²Ð»Ð¾Ð¶ÐµÐ½Ð½Ñ‹Ð¹ Ð¿ÑÐµÐ²Ð´Ð¾-Ð±Ð»Ð¾Ðº (Ð½Ð°Ð¿Ñ€Ð¸Ð¼ÐµÑ€, &:before { ... })
 * Ð²Ð½ÑƒÑ‚Ñ€Ð¸ Ð±Ð»Ð¾ÐºÐ° ÐºÐ»Ð°ÑÑÐ° .cls { ... }
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

  // Ð•ÑÐ»Ð¸ Ð²Ð»Ð¾Ð¶ÐµÐ½Ð½Ð¾Ð³Ð¾ Ð±Ð»Ð¾ÐºÐ° ÐµÑ‰Ñ‘ Ð½Ðµ Ð±Ñ‹Ð»Ð¾ â€” Ð²ÑÑ‚Ð°Ð²Ð»ÑÐµÐ¼ Ð¿ÐµÑ€ÐµÐ´ Ð·Ð°ÐºÑ€Ñ‹Ð²Ð°ÑŽÑ‰ÐµÐ¹ ÑÐºÐ¾Ð±ÐºÐ¾Ð¹ ÐºÐ»Ð°ÑÑÐ° }
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
