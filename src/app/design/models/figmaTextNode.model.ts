import type { HtmlNode } from "@/types/HtmlNode";

export interface FigmaTextItem {
  id: string;
  tag: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
  textAlign: string;
  color: string;
  backgroundColor?: string;
  className: string;
  section?: string;
}

export type ColorVariableMap = Map<string, string>; // hex (lowercase) -> "$color-1"

/**
 * Парсит массив строк переменных из базы в мапу: hex -> varName
 * Пример входящей строки: "$color-1: #162D5F;"
 */
export function buildColorMap(variables: string[]): ColorVariableMap {
  const map = new Map<string, string>();

  variables.forEach((entry) => {
    const match = entry.match(/^(\$[a-zA-Z0-9_-]+):\s*(#[a-zA-Z0-9]+);?$/);
    if (match) {
      const [, varName, hex] = match;
      map.set(hex.trim().toLowerCase(), varName.trim());
    }
  });

  return map;
}

/**
 * Безопасная генерация ключа
 */
function generateKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString();
}

/**
 * Сборка inline CSS-стилей узла с подстановкой переменной для цвета
 */
export function buildTextStyleString(
  item: FigmaTextItem,
  colorMap: ColorVariableMap,
): string {
  const hex = item.color.trim().toLowerCase();
  const colorVar = colorMap.get(hex) ?? item.color;

  const styles: string[] = [
    `font-family: '${item.fontFamily}', sans-serif`,
    `font-size: ${item.fontSize}px`,
    `font-weight: ${item.fontWeight}`,
    `line-height: ${item.lineHeight}px`,
    `letter-spacing: ${item.letterSpacing}`,
    `text-align: ${item.textAlign}`,
    `color: ${colorVar}`,
  ];

  return styles.join("; ") + ";";
}

/**
 * Создание HtmlNode из элемента texts Figma
 */
export function createHtmlNodeFromText(
  item: FigmaTextItem,
  colorMap: ColorVariableMap,
): HtmlNode {
  return {
    tag: item.tag || "p",
    text: item.text,
    class: item.className || "",
    style: buildTextStyleString(item, colorMap),
    attributes: {},
    _key: generateKey(),
    _isNew: true,
    children: [],
  };
}

/**
 * Парсинг блока texts из сырого Figma JSON
 */
export function extractTextsFromJson(rawJson: string): FigmaTextItem[] {
  const parsed = JSON.parse(rawJson);

  if (Array.isArray(parsed)) {
    const textBlock = parsed.find((block) => Array.isArray(block.texts));
    return textBlock?.texts ?? [];
  }

  if (parsed && Array.isArray(parsed.texts)) {
    return parsed.texts;
  }

  return [];
}
