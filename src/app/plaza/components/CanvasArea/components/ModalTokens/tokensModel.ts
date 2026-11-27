/**
 * @file tokensModel.ts
 * @description Утилиты для извлечения, манипуляции и синхронизации CSS переменных (:root) в SCSS
 */

export interface TokenItem {
  id: string;
  name: string; // e.g. "--btn-bg"
  value: string; // e.g. "#1e293b" or "30px"
  type: "color" | "dimension" | "other";
  comment?: string;
}

/**
 * Определяет тип значения переменной
 */
export function detectTokenType(value: string): "color" | "dimension" | "other" {
  const v = value.trim().toLowerCase();
  if (
    v.startsWith("#") ||
    v.startsWith("rgb") ||
    v.startsWith("hsl") ||
    v === "transparent" ||
    /^rgba?\([^)]+\)$/.test(v)
  ) {
    return "color";
  }
  if (/^[-+]?[0-9]*\.?[0-9]+(px|rem|em|%|vh|vw|pt)$/.test(v)) {
    return "dimension";
  }
  return "other";
}

/**
 * Извлекает блок :root из SCSS текста
 */
export function extractRootBlock(scss: string): { rootText: string; startIndex: number; endIndex: number } | null {
  if (!scss) return null;
  const match = scss.match(/:root\s*\{([\s\S]*?)\}/i);
  if (!match || match.index === undefined) return null;

  return {
    rootText: match[0],
    startIndex: match.index,
    endIndex: match.index + match[0].length,
  };
}

/**
 * Парсит текст блока :root в массив токенов
 */
export function parseTokensFromRootText(rootText: string): TokenItem[] {
  if (!rootText) return [];

  // Вытаскиваем внутренности фигурных скобок
  const innerMatch = rootText.match(/:root\s*\{([\s\S]*?)\}/i);
  const body = innerMatch ? innerMatch[1] : rootText;

  const lines = body.split("\n");
  const tokens: TokenItem[] = [];
  const tokenRegex = /^\s*(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);?(?:\s*\/\/\s*(.*))?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("/*") || line.startsWith("//")) continue;

    const match = line.match(tokenRegex);
    if (match) {
      const name = match[1].trim();
      const rawValue = match[2].trim().replace(/;$/, "");
      const comment = match[3] ? match[3].trim() : undefined;
      const type = detectTokenType(rawValue);

      tokens.push({
        id: `${name}_${i}`,
        name,
        value: rawValue,
        type,
        comment,
      });
    }
  }

  return tokens;
}

/**
 * Обновляет значение конкретного токена внутри блока :root в SCSS
 */
export function updateTokenInScss(
  scss: string,
  tokenName: string,
  newValue: string,
): string {
  const rootInfo = extractRootBlock(scss);
  if (!rootInfo) {
    const newRoot = `:root {\n  ${tokenName}: ${newValue};\n}\n\n`;
    return `${newRoot}${scss}`.trim();
  }

  const { rootText, startIndex, endIndex } = rootInfo;
  const escapedName = tokenName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(`(${escapedName}\\s*:\\s*)([^;]+)(;)`, "i");

  let updatedRoot = "";
  if (regex.test(rootText)) {
    updatedRoot = rootText.replace(regex, `$1${newValue}$3`);
  } else {
    updatedRoot = rootText.replace(/\}\s*$/, `  ${tokenName}: ${newValue};\n}`);
  }

  return `${scss.slice(0, startIndex)}${updatedRoot}${scss.slice(endIndex)}`;
}

/**
 * Заменяет или вставляет весь блок :root в SCSS
 */
export function replaceRootInScss(scss: string, newRootText: string): string {
  const rootInfo = extractRootBlock(scss);
  const cleanNewRoot = newRootText.trim();

  if (!rootInfo) {
    if (!cleanNewRoot) return scss;
    return `${cleanNewRoot}\n\n${scss}`.trim();
  }

  if (!cleanNewRoot) {
    const before = scss.slice(0, rootInfo.startIndex).trim();
    const after = scss.slice(rootInfo.endIndex).trim();
    return before && after ? `${before}\n\n${after}` : before || after;
  }

  return `${scss.slice(0, rootInfo.startIndex)}${cleanNewRoot}${scss.slice(rootInfo.endIndex)}`.trim();
}
