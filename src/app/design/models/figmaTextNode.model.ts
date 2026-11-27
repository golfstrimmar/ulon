import type { HtmlNode } from "@/types/HtmlNode";
import { buildFigmaBoundsAttributes } from "./figmaImageNode.model";
import { generateNodeKey } from "@/store/htmlTree";
import { getFontBaseClassName } from "../utils/figmaCssUtils";

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
  preview?: string;
  children?: FigmaStructureItem[];
}

export type ColorVariableMap = Map<string, string>; // hex (lowercase) -> "var(--color-1)"

const PRESERVED_NON_HEADING_TAGS = new Set([
  "a",
  "button",
  "label",
  "input",
  "textarea",
  "select",
  "option",
  "img",
  "svg",
  "i",
  "ul",
  "ol",
  "li",
  "nav",
  "section",
  "header",
  "footer",
  "main",
  "article",
  "aside",
  "form",
]);

function parseFontWeightValue(raw?: number | string): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw !== "string") return undefined;

  const normalized = raw.trim().toLowerCase();
  if (!normalized) return undefined;
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }
  if (normalized === "medium") return 500;
  if (
    normalized === "semibold" ||
    normalized === "semi-bold" ||
    normalized === "demibold"
  ) {
    return 600;
  }
  if (normalized === "bold") return 700;
  if (
    normalized === "extrabold" ||
    normalized === "extra-bold" ||
    normalized === "ultrabold"
  ) {
    return 800;
  }
  if (normalized === "black" || normalized === "heavy") return 900;
  if (normalized === "normal" || normalized === "regular") return 400;
  if (normalized === "light") return 300;
  return undefined;
}

function parseFontSizeValue(raw?: number | string): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw !== "string") return undefined;
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(?:px)?$/i);
  return match ? Number(match[1]) : undefined;
}

export function parseFontMetricsFromClassName(className?: string): {
  weight?: number;
  size?: number;
} {
  if (!className || !className.trim()) return {};

  let weight: number | undefined;
  let size: number | undefined;

  const classes = className.trim().split(/\s+/);

  for (const cls of classes) {
    const weightFirstMatch = cls.match(
      /(?:^|[-_])([1-9]00)[-_](\d{1,3})(?:px)?(?:$|[-_])/i,
    );
    if (weightFirstMatch) {
      weight = Number(weightFirstMatch[1]);
      const parsedSize = Number(weightFirstMatch[2]);
      if (parsedSize >= 8 && parsedSize <= 160) {
        size = parsedSize;
      }
      continue;
    }

    const sizeFirstMatch = cls.match(
      /(?:^|[-_])(\d{1,3})(?:px)?[-_]([1-9]00)(?:$|[-_])/i,
    );
    if (sizeFirstMatch) {
      const parsedSize = Number(sizeFirstMatch[1]);
      weight = Number(sizeFirstMatch[2]);
      if (parsedSize >= 8 && parsedSize <= 160) {
        size = parsedSize;
      }
      continue;
    }

    const tokens = cls.toLowerCase().split(/[-_]+/).filter(Boolean);
    for (const token of tokens) {
      if (weight === undefined) {
        if (/^[1-9]00$/.test(token)) {
          weight = Number(token);
          continue;
        }
        if (token === "extrabold" || token === "ultrabold") {
          weight = 800;
          continue;
        }
        if (token === "semibold" || token === "demibold") {
          weight = 600;
          continue;
        }
        if (token === "bold") {
          weight = 700;
          continue;
        }
        if (token === "medium") {
          weight = 500;
          continue;
        }
        if (token === "black" || token === "heavy") {
          weight = 900;
          continue;
        }
      }

      if (size === undefined) {
        const sizeMatch = token.match(/^(\d{1,3})(?:px)?$/);
        if (sizeMatch) {
          const n = Number(sizeMatch[1]);
          if (n >= 10 && n <= 96 && n % 100 !== 0) {
            size = n;
          }
        }
      }
    }
  }

  return { weight, size };
}

export function resolveHeadingTagByFontSize(fontSize?: number): string {
  const size = fontSize ?? 16;
  if (size >= 32) return "h2";
  if (size >= 24) return "h3";
  if (size >= 20) return "h4";
  if (size >= 17) return "h5";
  return "h6";
}

export const getHeadingTagByFontSize = resolveHeadingTagByFontSize;

export function resolveSemanticTextTag(params: {
  rawTag?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  className?: string;
  hasChildren?: boolean;
}): string {
  const rawTag = (params.rawTag || "").trim().toLowerCase();

  if (/^h[1-6]$/.test(rawTag)) {
    return rawTag;
  }

  if (PRESERVED_NON_HEADING_TAGS.has(rawTag)) {
    return rawTag;
  }

  if (params.hasChildren && rawTag !== "p" && rawTag !== "span") {
    return rawTag || "div";
  }

  const fromClass = parseFontMetricsFromClassName(params.className);
  const effectiveWeight =
    parseFontWeightValue(params.fontWeight) ?? fromClass.weight;
  const effectiveSize = parseFontSizeValue(params.fontSize) ?? fromClass.size;

  const canPromoteToHeading =
    !params.hasChildren &&
    (rawTag === "" || rawTag === "p" || rawTag === "span");

  if (
    canPromoteToHeading &&
    effectiveWeight !== undefined &&
    effectiveWeight >= 500
  ) {
    return resolveHeadingTagByFontSize(effectiveSize);
  }

  return rawTag || (params.hasChildren ? "div" : "p");
}

/**
 * Парсит массив переменных из базы в мапу: hex -> "var(--color-1)" | "$color-1"
 */
export function buildColorMap(variables: string[]): ColorVariableMap {
  const map = new Map<string, string>();
  variables.forEach((entry) => {
    const match = entry.match(
      /^(\$[a-zA-Z0-9_-]+|--[a-zA-Z0-9_-]+)\s*:\s*(#[a-zA-Z0-9]+)\s*;?$/,
    );
    if (match) {
      const [, rawName, hex] = match;
      const varName = rawName.trim();
      const cssValue = varName.startsWith("--") ? `var(${varName})` : varName;
      map.set(hex.trim().toLowerCase(), cssValue);
    }
  });
  return map;
}

function resolveColorWithMap(
  rawColor: string,
  colorMap: ColorVariableMap,
): string {
  const hex = rawColor.trim().toLowerCase();
  return colorMap.get(hex) ?? rawColor;
}

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

export function buildTextStyleString(
  item: FigmaTextItem,
  colorMap: ColorVariableMap,
): string {
  const colorVar = resolveColorWithMap(item.color, colorMap);

  const styles: string[] = [
    `font-family: '${item.fontFamily}', sans-serif`,
    `font-size: ${item.fontSize}px`,
    `font-weight: ${item.fontWeight}`,
    `line-height: ${formatLineHeight(item.lineHeight)}`,
    `letter-spacing: ${item.letterSpacing}`,
    `text-align: ${item.textAlign}`,
    `color: ${colorVar}`,
  ];

  if (item.backgroundColor) {
    styles.push(
      `background-color: ${resolveColorWithMap(item.backgroundColor, colorMap)}`,
    );
  }

  return styles.join("; ") + ";";
}

export function createHtmlNodeFromText(
  item: FigmaTextItem,
  colorMap: ColorVariableMap,
): HtmlNode {
  return createHtmlNodeFromStructureItem(item, colorMap);
}

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
    styles.push(`color: ${resolveColorWithMap(item.color, colorMap)}`);
  }
  if (item.backgroundColor) {
    styles.push(
      `background-color: ${resolveColorWithMap(item.backgroundColor, colorMap)}`,
    );
  }

  const inlineStyles = styles.length > 0 ? styles.join("; ") + ";" : "";

  const children: HtmlNode[] = Array.isArray(item.children)
    ? sortByFigmaId(item.children).map((child) =>
        createHtmlNodeFromStructureItem(child, colorMap),
      )
    : [];

  const figmaMeta: Record<string, unknown> = {};
  if (item.name) figmaMeta.name = item.name;
  if (item.preview) figmaMeta.preview = item.preview;
  if (typeof item.x === "number" && Number.isFinite(item.x))
    figmaMeta.x = item.x;
  if (typeof item.y === "number" && Number.isFinite(item.y))
    figmaMeta.y = item.y;
  if (typeof item.width === "number" && Number.isFinite(item.width))
    figmaMeta.width = item.width;
  if (typeof item.height === "number" && Number.isFinite(item.height))
    figmaMeta.height = item.height;
  if (typeof item.pageX === "number" && Number.isFinite(item.pageX))
    figmaMeta.pageX = item.pageX;
  if (typeof item.pageY === "number" && Number.isFinite(item.pageY))
    figmaMeta.pageY = item.pageY;
  if (item.sectionId) figmaMeta.sectionId = item.sectionId;
  if (
    typeof item.sectionWidth === "number" &&
    Number.isFinite(item.sectionWidth)
  )
    figmaMeta.sectionWidth = item.sectionWidth;
  if (
    typeof item.sectionHeight === "number" &&
    Number.isFinite(item.sectionHeight)
  )
    figmaMeta.sectionHeight = item.sectionHeight;

  const resolvedTag = resolveSemanticTextTag({
    rawTag: item.tag,
    fontWeight: item.fontWeight,
    fontSize: item.fontSize,
    className: item.className,
    hasChildren: children.length > 0,
  });

  const rawClass = (item.className || "").trim();
  const resolvedClass = rawClass
    ? rawClass
    : item.fontSize !== undefined || item.fontWeight !== undefined
      ? getFontBaseClassName({
          fontSize: item.fontSize,
          fontWeight: item.fontWeight,
        })
      : "";

  return {
    tag: resolvedTag,
    text: item.text || "",
    class: resolvedClass,
    style: inlineStyles,
    attributes: {},
    _key: generateNodeKey(),
    _isNew: true,
    children,
    ...(Object.keys(figmaMeta).length > 0
      ? ({ _figma: figmaMeta } as any)
      : {}),
  };
}

export function extractStructureFromJson(
  rawJson: string,
): FigmaStructureItem[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      const structBlock = parsed.find((block) =>
        Array.isArray(block?.structure),
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

export function extractPreviewFromJson(rawJson: string): string | undefined {
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      const structBlock = parsed.find((block) =>
        Array.isArray(block?.structure),
      );
      const first = structBlock?.structure?.[0];
      if (first?.preview && typeof first.preview === "string") {
        return first.preview;
      }
    } else if (parsed && Array.isArray(parsed?.structure)) {
      const first = parsed.structure[0];
      if (first?.preview && typeof first.preview === "string") {
        return first.preview;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function flattenStructureTexts(
  items: FigmaStructureItem[],
): FigmaTextItem[] {
  const result: FigmaTextItem[] = [];

  function traverse(item: FigmaStructureItem, currentSection?: string) {
    const section = item.section || currentSection || item.name;
    if (item.text) {
      const hasChildren =
        Array.isArray(item.children) && item.children.length > 0;
      const fromClass = parseFontMetricsFromClassName(item.className);
      const effectiveSize = item.fontSize ?? fromClass.size ?? 16;
      const effectiveWeight = item.fontWeight ?? fromClass.weight ?? 400;

      result.push({
        id: item.id,
        tag: resolveSemanticTextTag({
          rawTag: item.tag,
          fontWeight: effectiveWeight,
          fontSize: effectiveSize,
          className: item.className,
          hasChildren,
        }),
        text: item.text,
        fontFamily: item.fontFamily || "sans-serif",
        fontSize: effectiveSize,
        fontWeight: effectiveWeight,
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

export function generateScssForTextItems(
  items: FigmaTextItem[],
  colorMap: ColorVariableMap,
): string {
  const seenClasses = new Set<string>();
  const blocks: string[] = [];

  for (const item of items) {
    const cls = item.className?.trim();
    if (!cls || seenClasses.has(cls)) continue;
    seenClasses.add(cls);

    const colorVar = resolveColorWithMap(item.color, colorMap);
    const bgLine = item.backgroundColor
      ? `\n  background-color: ${resolveColorWithMap(item.backgroundColor, colorMap)};`
      : "";

    blocks.push(
      `.${cls} {\n  font-family: '${item.fontFamily}', sans-serif;\n  font-size: ${item.fontSize}px;\n  font-weight: ${item.fontWeight};\n  line-height: ${formatLineHeight(item.lineHeight)};\n  letter-spacing: ${item.letterSpacing};\n  text-align: ${item.textAlign};\n  color: ${colorVar};${bgLine}\n}`,
    );
  }

  return blocks.join("\n\n");
}
