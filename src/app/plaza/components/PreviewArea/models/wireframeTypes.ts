import type { HtmlNode } from "@/types/HtmlNode";

export type ListItemPreset = "none" | "a" | "a-i" | "i-span" | "a-i-span";
export type ListDirection = "auto" | "row" | "column" | "wrap";

export interface WireframeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
  tag?: string;
  style?: string;
  donorKey?: string;
  consumedDonorKeys?: string[];
  sortPriority?: number;
  listItemPreset?: ListItemPreset;
  listDirection?: ListDirection;
  parentId?: string;
}

export interface OverlayMetrics {
  hasActiveOverlay: boolean;
  imgWidth: number;
  align: string;
  offsetX: number;
  offsetY: number;
  overlayImage?: string;
}

export interface IntermediateNode {
  box: WireframeBox;
  children: IntermediateNode[];
  parent: IntermediateNode | null;
  computedStyle?: string;
}

export interface RawFigmaNodeEntry {
  key: string;
  tag: string;
  node: HtmlNode;
  isSvgShape: boolean;
  isImageBlock: boolean;
  isContainerNode: boolean;
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  width: number;
  height: number;
  sectionId: string;
  sectionWidth: number;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutNode {
  entry: RawFigmaNodeEntry;
  rect: LayoutRect;
  box: WireframeBox;
  children: LayoutNode[];
  isExplicitContainer: boolean;
}

export const LEAF_TAGS = new Set([
  "img",
  "svg",
  "i",
  "p",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "label",
  "input",
  "textarea",
  "hr",
  "br",
]);

export function makeNodeKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function isImageWrapperNode(node: HtmlNode | null | undefined): boolean {
  if (!node) return false;
  const tag = (node.tag || "").trim().toLowerCase();
  if (
    tag !== "div" ||
    !Array.isArray(node.children) ||
    node.children.length === 0
  ) {
    return false;
  }
  return node.children.some((ch) => {
    const chTag = (ch.tag || "").trim().toLowerCase();
    const chClasses = (ch.class || "").trim().split(/\s+/);
    return chTag === "div" && chClasses.includes("is");
  });
}

export function canBeParentContainer(
  box: WireframeBox,
  donorMap?: Map<string, HtmlNode>,
): boolean {
  const explicitTag = (box.tag || "").trim().toLowerCase();
  if (explicitTag) {
    return !LEAF_TAGS.has(explicitTag);
  }
  if (box.donorKey && donorMap) {
    const donor = donorMap.get(box.donorKey);
    if (isImageWrapperNode(donor)) {
      return false;
    }
    const donorTag = (donor?.tag || "").trim().toLowerCase();
    if (donorTag && LEAF_TAGS.has(donorTag)) {
      return false;
    }
  }
  return true;
}

export function getBoxSortPriority(
  box: WireframeBox,
  donorMap?: Map<string, HtmlNode>,
): number {
  if (typeof box.sortPriority === "number") return box.sortPriority;
  if (!canBeParentContainer(box, donorMap)) return 0;
  const tag = (box.tag || "").trim().toLowerCase();
  if (tag === "section") return 3;
  if (!box.donorKey) return 2;
  return 1;
}

export function mergeInlineStyles(
  baseStyle?: string,
  extraStyle?: string,
): string {
  const parts: string[] = [];
  const seen = new Map<string, string>();

  for (const raw of [baseStyle, extraStyle]) {
    if (!raw || !raw.trim()) continue;
    for (const decl of raw.split(";")) {
      const trimmed = decl.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (prop && val) {
        seen.set(prop, val);
      }
    }
  }

  for (const [prop, val] of seen.entries()) {
    parts.push(`${prop}: ${val}`);
  }
  return parts.length > 0 ? `${parts.join("; ")};` : "";
}

export function formatCssBoxSpacing(
  prop: "padding" | "margin",
  top: number,
  right: number,
  bottom: number,
  left: number,
): string {
  if (top === 0 && right === 0 && bottom === 0 && left === 0) return "";
  if (top === right && right === bottom && bottom === left) {
    return `${prop}: ${top}px;`;
  }
  if (top === bottom && left === right) {
    return `${prop}: ${top}px ${right}px;`;
  }
  if (left === right) {
    return `${prop}: ${top}px ${right}px ${bottom}px;`;
  }
  return `${prop}: ${top}px ${right}px ${bottom}px ${left}px;`;
}

export function stripFigmaAttributes(node: HtmlNode): HtmlNode {
  let nextAttrs = node.attributes;
  if (nextAttrs && typeof nextAttrs === "object") {
    const cleaned: Record<string, string> = {};
    let removedAny = false;
    for (const [k, v] of Object.entries(nextAttrs)) {
      if (k.startsWith("data-figma-")) {
        removedAny = true;
      } else {
        cleaned[k] = v;
      }
    }
    if (removedAny) {
      nextAttrs = Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
  }

  const cleanedNode: any = {
    ...node,
    attributes: nextAttrs,
    children: Array.isArray(node.children)
      ? node.children.map(stripFigmaAttributes)
      : node.children,
  };
  delete cleanedNode._figma;
  return cleanedNode as HtmlNode;
}

export function isContained(
  inner: LayoutRect,
  outer: LayoutRect,
  tolerance = 3,
): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

export function computeBoundingRect(items: { rect: LayoutRect }[]): LayoutRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    if (item.rect.x < minX) minX = item.rect.x;
    if (item.rect.y < minY) minY = item.rect.y;
    if (item.rect.x + item.rect.width > maxX)
      maxX = item.rect.x + item.rect.width;
    if (item.rect.y + item.rect.height > maxY)
      maxY = item.rect.y + item.rect.height;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(2, maxX - minX),
    height: Math.max(2, maxY - minY),
  };
}

export function isSameBounds(
  a: LayoutRect,
  b: LayoutRect,
  tolerance = 4,
): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance * 2 &&
    Math.abs(a.height - b.height) <= tolerance * 2
  );
}
