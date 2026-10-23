/**
 * @file cssCompiler.ts
 * @description Компиляция и парсинг словаря стилей классов для финального списка свойств.
 */

/**
 * Преобразует словарь { [className]: cssRules } в валидный CSS для блока <style>.
 * Поддерживает как список свойств (color: red; padding: 10px),
 * так и полноценные блоки селекторов (.class { ... }, .class:hover { ... }).
 */
export function compileClassesCss(styles: Record<string, string>): string {
  if (!styles || typeof styles !== "object") return "";

  const blocks: string[] = [];

  for (const [rawClass, rawCss] of Object.entries(styles)) {
    const className = rawClass.trim().replace(/^\./, "");
    const trimmedCss = (rawCss || "").trim();
    if (!className || !trimmedCss) continue;

    // Если пользователь уже ввел селектор с фигурными скобками { ... }
    if (trimmedCss.includes("{") && trimmedCss.includes("}")) {
      blocks.push(trimmedCss);
    } else {
      // Форматируем как валидный блок .className { ... }
      const indented = trimmedCss
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => (line.endsWith(";") ? `  ${line}` : `  ${line};`))
        .join("\n");

      blocks.push(`.${className} {\n${indented}\n}`);
    }
  }

  return blocks.join("\n\n");
}

/**
 * Парсит скомпилированный CSS обратно в словарь { [className]: cssRules }.
 * Позволяет двустороннее редактирование финального списка свойств.
 */
export function parseClassesCss(fullCss: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fullCss || !fullCss.trim()) return result;

  // Ищем селекторы вида .className { rules }
  const ruleRegex = /\.([a-zA-Z0-9_\-]+(?:[:][a-zA-Z0-9_\-]+)?)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(fullCss)) !== null) {
    const selector = match[1].trim();
    const rules = match[2]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");

    if (selector && rules) {
      result[selector] = rules;
    }
  }

  return result;
}
