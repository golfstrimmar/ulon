// utils/figmaColors.ts

export interface ColorToken {
  varName: string;
  hex: string;
  original: string;
}

export interface ParseResult {
  tokens: ColorToken[];
  error: string | null;
}

/**
 * Парсит сырую строку JSON, валидирует и извлекает массив токенов цветов
 */
export function parseFigmaColors(rawJson: string): ParseResult {
  const trimmed = rawJson.trim();
  if (!trimmed) {
    return { tokens: [], error: null };
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (!Array.isArray(parsed)) {
      return { tokens: [], error: "Root element must be an array: [...]" };
    }

    // Ищем секцию colors внутри массива
    const colorSection = parsed.find((item) => Array.isArray(item?.colors));
    if (!colorSection || !colorSection.colors.length) {
      return {
        tokens: [],
        error: 'Section with "colors": [...] not found in the JSON',
      };
    }

    const tokens: ColorToken[] = colorSection.colors.map(
      (c: any, index: number) => ({
        varName: `$color-${index + 1}`,
        hex: c.hex,
        original: c.original,
      }),
    );

    return { tokens, error: null };
  } catch (err: any) {
    return { tokens: [], error: err.message || "Invalid JSON format" };
  }
}

/**
 * Генерирует готовую строку SCSS файла с переменными
 */
export function generateScss(tokens: ColorToken[]): string {
  if (!tokens.length) return "";

  const header = `// -----------------------------------------\n// Colors from Figma Plugin\n// -----------------------------------------\n\n`;
  const lines = tokens.map((t) => `${t.varName}: ${t.hex}; // ${t.original}`);

  return header + lines.join("\n");
}
