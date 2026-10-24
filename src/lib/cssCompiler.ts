/**
 * @file cssCompiler.ts
 * @description Компиляция и парсинг стандартного классического CSS (.class и .class:hover).
 */

/**
 * Очищает CSS от старых ошибочных матрешек (.ttt { .ttt { ... } })
 */
function sanitizeDoubleNesting(className: string, cssText: string): string {
  let cleaned = (cssText || "").trim();
  const cls = className.replace(/^\./, "");

  // Если текст начинается с .cls { и внутри снова есть .cls {
  const doubleWrapRegex = new RegExp(
    `^\\.${cls}\\s*\\{\\s*(\\.(?:${cls})[\\s\\S]*)\\}\\s*$`,
  );
  const match = doubleWrapRegex.exec(cleaned);
  if (match && match[1]) {
    cleaned = match[1].trim();
  }

  return cleaned;
}

/**
 * Собирает CSS для вставки в <style>.
 * Если стиль уже написан как нормальное правило со скобками (.ttt { ... } .ttt:hover { ... }) —
 * отдает его КАК ЕСТЬ, без слепых оберток!
 */
export function compileClassesCss(
  classesCss: Record<string, string> = {},
): string {
  const result: string[] = [];

  for (const [rawCls, rawCss] of Object.entries(classesCss)) {
    const cleanCls = rawCls.trim().replace(/^\./, "");
    if (!cleanCls || !rawCss) continue;

    let body = sanitizeDoubleNesting(cleanCls, rawCss.trim());
    if (!body) continue;

    // Если код уже содержит селекторы и скобки (например .ttt { ... } или .ttt:hover { ... })
    if (body.includes("{") && body.includes("}")) {
      result.push(body);
    } else {
      // Это просто плоский список свойств (color: red; font-size: 20px;) -> только тогда оборачиваем
      result.push(`.${cleanCls} {\n  ${body}\n}`);
    }
  }

  return result.join("\n\n");
}

/**
 * Парсит полный CSS обратно в словарь.
 * Группирует .ttt, .ttt:hover, .ttt:active, .ttt::before друг под другом без вложений.
 */
export function parseClassesCss(fullCss: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fullCss || !fullCss.trim()) return result;

  let pos = 0;
  const len = fullCss.length;

  while (pos < len) {
    const nextBrace = fullCss.indexOf("{", pos);
    if (nextBrace === -1) break;

    const rawSelector = fullCss.slice(pos, nextBrace).trim();
    pos = nextBrace + 1;

    let braceCount = 1;
    const bodyStart = pos;

    while (pos < len && braceCount > 0) {
      const char = fullCss[pos];
      if (char === "{") braceCount++;
      else if (char === "}") braceCount--;
      pos++;
    }

    const body = fullCss
      .slice(bodyStart, pos - (braceCount === 0 ? 1 : 0))
      .trim();

    if (!rawSelector) continue;

    // СЛУЧАЙ 1: @media
    if (rawSelector.startsWith("@media")) {
      const classMatches = body.matchAll(/\.([a-zA-Z0-9_-]+)/g);
      const foundClasses = new Set<string>();
      for (const m of classMatches) {
        if (m[1]) foundClasses.add(m[1]);
      }

      const mediaBlock = `${rawSelector} {\n  ${body}\n}`;
      for (const cls of foundClasses) {
        result[cls] = result[cls]
          ? `${result[cls]}\n\n${mediaBlock}`
          : mediaBlock;
      }
      continue;
    }

    // СЛУЧАЙ 2: Стандартные правила (.ttt, .ttt:hover, .ttt::before)
    const match = /\.([a-zA-Z0-9_-]+)/.exec(rawSelector);
    if (match && match[1]) {
      const className = match[1];
      const cleanSelector = rawSelector.replace(/\/\*[\s\S]*?\*\//g, "").trim();

      // Стандартный плоский блок CSS
      const fullRule = `${cleanSelector} {\n  ${body}\n}`;

      if (result[className]) {
        // Дописываем правило рядом, а не внутрь!
        result[className] = `${result[className]}\n\n${fullRule}`;
      } else {
        result[className] = fullRule;
      }
    }
  }

  // Финальная чистка от случайных матрешек
  for (const [cls, css] of Object.entries(result)) {
    result[cls] = sanitizeDoubleNesting(cls, css);
  }

  return result;
}
