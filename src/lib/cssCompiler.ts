/**
 * @file cssCompiler.ts
 * @description Чистая компиляция без скрытых оберток.
 */

/**
 * Автоматически лечит любые вложенные матрешки (.ttt { .ttt { ... } })
 * и превращает их в плоские правила (.ttt { ... } и .ttt:hover { ... })
 */
export function repairCss(className: string, rawCss: string): string {
  let css = (rawCss || "").trim();
  const cls = className.replace(/^\./, "");
  if (!css) return `.${cls} {\n  \n}`;

  // Вытаскиваем &:hover или :hover в отдельное нормальное правило .cls:hover
  const hoverMatch = /&?:hover\s*\{([^}]+)\}/.exec(css);
  let hoverBody = "";
  if (hoverMatch) {
    hoverBody = hoverMatch[1].trim();
    // Удаляем кусок с ховером из основного тела
    css = css.replace(hoverMatch[0], "").trim();
  }

  // Срезаем все внешние дублирующиеся .cls { и закрывающие }
  const cleanDeclarations = css
    .replace(new RegExp(`\\.${cls}\\s*\\{`, "g"), "")
    .replace(/\}/g, "")
    .trim();

  const baseRule = `.${cls} {\n  ${cleanDeclarations
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n  ")}\n}`;

  if (hoverBody) {
    const hoverRule = `.${cls}:hover {\n  ${hoverBody
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n  ")}\n}`;
    return `${baseRule}\n\n${hoverRule}`;
  }

  return baseRule;
}

/**
 * Просто склеивает готовые CSS-правила классов для вставки в <style>.
 * НИКАКИХ скрытых оборачиваний!
 */
export function compileClassesCss(
  classesCss: Record<string, string> = {},
): string {
  const result: string[] = [];

  for (const [cls, rawCss] of Object.entries(classesCss)) {
    const cleanCls = cls.trim().replace(/^\./, "");
    if (!cleanCls || !rawCss?.trim()) continue;

    // Лечим от матрешек и отдаем чистый CSS
    const cleanRule = repairCss(cleanCls, rawCss);
    result.push(cleanRule);
  }

  return result.join("\n\n");
}

/**
 * Парсит полный CSS из модалки обратно в словарь классов.
 * Склеивает .ttt и .ttt:hover вместе в ключ "ttt".
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

    // Ищем имя класса (например ".ttt:hover" -> "ttt")
    const match = /\.([a-zA-Z0-9_-]+)/.exec(rawSelector);
    if (match && match[1]) {
      const className = match[1];
      const cleanSelector = rawSelector.replace(/\/\*[\s\S]*?\*\//g, "").trim();

      const rule = `${cleanSelector} {\n  ${body}\n}`;

      if (result[className]) {
        result[className] = `${result[className]}\n\n${rule}`;
      } else {
        result[className] = rule;
      }
    }
  }

  return result;
}
