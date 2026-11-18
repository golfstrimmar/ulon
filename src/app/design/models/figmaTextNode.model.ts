import type { HtmlNode } from "@/types/HtmlNode";
import { buildFigmaBoundsAttributes } from "./figmaImageNode.model";

export interface FigmaTextItem {
  id: string;
  tag: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number | string;
  letterSpacing: string | number;
  textAlign: string;
  color: string;
  backgroundColor?: string;
  className: string;
  section?: string;
  sectionId?: string;
  sectionWidth?: number;
  sectionHeight?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  pageX?: number;
  pageY?: number;
}

export interface FigmaStructureItem {
  id: string;
  name?: string;
  tag: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number | string;
  letterSpacing?: string | number;
  textAlign?: string;
  color?: string;
  backgroundColor?: string;
  className?: string;
  section?: string;
  sectionId?: string;
  sectionWidth?: number;
  sectionHeight?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  pageX?: number;
  pageY?: number;
  children?: FigmaStructureItem[];
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
 * Сортировка элементов Figma по числовой части id ("40:1433" → 1433) — порядок создания = визуальный порядок сверху вниз
 */
function sortByFigmaId(items: FigmaStructureItem[]): FigmaStructureItem[] {
  return [...items].sort((a, b) => {
    const idA = parseInt(a.id?.split(":")[1] ?? "0", 10);
    const idB = parseInt(b.id?.split(":")[1] ?? "0", 10);
    return idA - idB;
  });
}

function formatLineHeight(lh: number | string): string {
  if (typeof lh === "number") return `${lh}px`;
  const trimmed = String(lh).trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
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
    `line-height: ${formatLineHeight(item.lineHeight)}`,
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
  return createHtmlNodeFromStructureItem(item, colorMap);
}

/**
 * Рекурсивное создание HtmlNode из узла структуры Figma (сохраняя вложенность, порядок и Figma-координаты)
 */
export function createHtmlNodeFromStructureItem(
  item: FigmaStructureItem,
  colorMap: ColorVariableMap,
): HtmlNode {
  const styles: string[] = [];

  if (item.fontFamily) {
    styles.push(`font-family: '${item.fontFamily}', sans-serif`);
  }
  if (item.fontSize !== undefined) {
    styles.push(`font-size: ${item.fontSize}px`);
  }
  if (item.fontWeight !== undefined) {
    styles.push(`font-weight: ${item.fontWeight}`);
  }
  if (item.lineHeight !== undefined) {
    styles.push(`line-height: ${formatLineHeight(item.lineHeight)}`);
  }
  if (item.letterSpacing !== undefined) {
    styles.push(`letter-spacing: ${item.letterSpacing}`);
  }
  if (item.textAlign) {
    styles.push(`text-align: ${item.textAlign}`);
  }
  if (item.color) {
    styles.push(`color: ${item.color}`);
  }
  const inlineStyles = styles.length > 0 ? styles.join("; ") + ";" : "";

  const children: HtmlNode[] = Array.isArray(item.children)
    ? sortByFigmaId(item.children).map((child) =>
        createHtmlNodeFromStructureItem(child, colorMap),
      )
    : [];

  const boundsAttrs = buildFigmaBoundsAttributes({
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    pageX: item.pageX,
    pageY: item.pageY,
    sectionId: item.sectionId,
    sectionWidth: item.sectionWidth,
    sectionHeight: item.sectionHeight,
  });

  const attributes: Record<string, string> = {
    ...(item.name ? { "data-name": item.name } : {}),
    ...boundsAttrs,
  };

  return {
    tag: item.tag || (children.length > 0 ? "div" : "p"),
    text: item.text || "",
    class: item.className || "",
    style: inlineStyles,
    attributes,
    _key:
      item.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString()),
    _isNew: true,
    children,
  };
}

/**
 * Парсинг блока structure из сырого Figma JSON
 */
export function extractStructureFromJson(
  rawJson: string,
): FigmaStructureItem[] {
  try {
    const parsed = JSON.parse(rawJson);

    if (Array.isArray(parsed)) {
      const structBlock = parsed.find((block) =>
        Array.isArray(block.structure),
      );
      const list = structBlock?.structure ?? [];
      return sortByFigmaId(list);
    }

    if (parsed && Array.isArray(parsed.structure)) {
      return sortByFigmaId([...parsed.structure]);
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Рекурсивно собирает все текстовые элементы из дерева structure
 */
export function flattenStructureTexts(
  items: FigmaStructureItem[],
): FigmaTextItem[] {
  const result: FigmaTextItem[] = [];

  function traverse(item: FigmaStructureItem, currentSection?: string) {
    const section = item.section || currentSection || item.name;
    if (item.text) {
      result.push({
        id: item.id,
        tag: item.tag,
        text: item.text,
        fontFamily: item.fontFamily || "sans-serif",
        fontSize: item.fontSize || 16,
        fontWeight: item.fontWeight || 400,
        lineHeight: item.lineHeight ?? 20,
        letterSpacing: item.letterSpacing ?? "0%",
        textAlign: item.textAlign || "left",
        color: item.color || "#000000",
        backgroundColor: item.backgroundColor,
        className: item.className || "",
        section,
      });
    }

    if (Array.isArray(item.children)) {
      sortByFigmaId(item.children).forEach((child) => traverse(child, section));
    }
  }

  items.forEach((item) => traverse(item));
  return result;
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

/**
 * Генерация SCSS-класса для сохранения в GlobalScss плазы
 */
export function generateScssForTextItems(
  items: FigmaTextItem[],
  colorMap: ColorVariableMap,
): string {
  return items
    .filter((item) => Boolean(item.className))
    .map((item) => {
      const hex = item.color.trim().toLowerCase();
      const colorVar = colorMap.get(hex) || item.color; // переменная $color-N

      return `.${item.className} {
  font-family: '${item.fontFamily}', sans-serif;
  font-size: ${item.fontSize}px;
  font-weight: ${item.fontWeight};
  line-height: ${formatLineHeight(item.lineHeight)};
  letter-spacing: ${item.letterSpacing};
  text-align: ${item.textAlign};
  color: ${colorVar};
}`;
    })
    .join("\n\n");
}
