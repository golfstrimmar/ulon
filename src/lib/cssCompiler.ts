/**
 * @file cssCompiler.ts
 * @description Компиляция и парсинг словаря стилей классов для финального списка свойств.
 */

/**
 * Преобразует словарь { [className]: cssRules } в валидный CSS для блока <style>.
 * Поддерживает как список свойств (color: red; padding: 10px),
 * так и полноценные блоки селекторов (.class { ... }, .class:hover { ... }).
 */
export function compileClassesCss(
  classesCss: Record<string, string> = {},
): string {
  const result: string[] = [];

  for (const [rawCls, rawCss] of Object.entries(classesCss)) {
    const cleanCls = rawCls.trim().replace(/^\./, "");
    const trimmedCss = (rawCss || "").trim();

    if (!cleanCls || !trimmedCss) continue;

    // Если стили уже были обернуты в этот же селектор — не дублируем
    if (trimmedCss.startsWith(`.${cleanCls}`) && trimmedCss.includes("{")) {
      result.push(trimmedCss);
    } else {
      result.push(
        `.${cleanCls} {\n  ${trimmedCss
          .split("\n")
          .map((l) => l.trimEnd())
          .join("\n  ")}\n}`,
      );
    }
  }

  return result.join("\n\n");
}

/**
 * Парсит скомпилированный CSS обратно в словарь { [className]: cssRules }.
 * Позволяет двустороннее редактирование финального списка свойств.
 */
export function parseClassesCss(fullCss: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fullCss || !fullCss.trim()) return result;

  let pos = 0;
  const len = fullCss.length;

  while (pos < len) {
    // Пропускаем пробелы и комментарии
    const nextBrace = fullCss.indexOf("{", pos);
    if (nextBrace === -1) break;

    const selector = fullCss.slice(pos, nextBrace).trim();
    pos = nextBrace + 1;

    // Считаем баланс фигурных скобок, чтобы не сломаться на &:hover { ... }
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

    if (selector) {
      // Извлекаем имя класса из селектора (например ".btn:hover" -> "btn")
      const match = /\.([a-zA-Z0-9_-]+)/.exec(selector);
      if (match && match[1]) {
        const className = match[1];
        result[className] = body;
      }
    }
  }

  return result;
}
