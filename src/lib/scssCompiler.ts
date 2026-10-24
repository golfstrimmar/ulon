/**
 * @file scssCompiler.ts
 * @description Компиляция SCSS в CSS и обновление конкретного класса на месте.
 */

export async function compileScssToCss(scss: string): Promise<string> {
  const code = (scss || "").trim();
  if (!code) return "";

  try {
    const res = await fetch("/api/compile-scss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scss: code }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.css || "";
    }
  } catch (e) {
    // Фоллбэк
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

export function compileClassesCss(): string {
  return "";
}
