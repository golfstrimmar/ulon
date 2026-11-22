import type { HtmlNode } from "@/types/HtmlNode";
import {
  computeBoundingRect,
  isImageWrapperNode,
  makeNodeKey,
  mergeInlineStyles,
  type LayoutNode,
  type LayoutRect,
  type ListItemPreset,
} from "./wireframeTypes";
import { isSvgDonorNode } from "./wireframeFigmaCollector";

const OUTER_LI_PROPS = new Set([
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "flex",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "width",
  "min-width",
  "max-width",
  "align-self",
]);

function splitLiStyles(style?: string): {
  outerStyle: string;
  innerStyle: string;
} {
  if (!style || !style.trim()) return { outerStyle: "", innerStyle: "" };
  const outer: string[] = [];
  const inner: string[] = [];

  for (const raw of style.split(";")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const val = trimmed.slice(colonIdx + 1).trim();
    if (!prop || !val) continue;

    if (OUTER_LI_PROPS.has(prop)) {
      outer.push(`${prop}: ${val}`);
    } else {
      inner.push(`${prop}: ${val}`);
    }
  }

  return {
    outerStyle: outer.length > 0 ? `${outer.join("; ")};` : "",
    innerStyle: inner.length > 0 ? `${inner.join("; ")};` : "",
  };
}

function isTextLikeNode(node: HtmlNode): boolean {
  if (isSvgDonorNode(node) || isImageWrapperNode(node)) return false;
  const tag = (node.tag || "").trim().toLowerCase();
  if (tag === "img" || tag === "svg" || tag === "i") return false;
  if (
    tag === "p" ||
    tag === "span" ||
    tag === "a" ||
    tag.startsWith("h") ||
    tag === "label"
  ) {
    return true;
  }
  return Boolean(node.text && node.text.trim());
}

function normalizeToIconNode(node?: HtmlNode): HtmlNode {
  if (!node) {
    return {
      tag: "i",
      text: "",
      class: "",
      style: "",
      children: [],
      _key: makeNodeKey("i"),
    };
  }
  if ((node.tag || "").trim().toLowerCase() === "i") {
    return node;
  }
  return {
    tag: "i",
    text: "",
    class: "",
    style: "",
    children: [node],
    _key: makeNodeKey("i"),
  };
}

function normalizeToSpanNode(node?: HtmlNode): HtmlNode {
  if (!node) {
    return {
      tag: "span",
      text: "",
      class: "",
      style: "",
      children: [],
      _key: makeNodeKey("span"),
    };
  }
  return {
    ...node,
    tag: "span",
  };
}

function unwrapSingleSyntheticWrapper(liNode: HtmlNode): {
  children: HtmlNode[];
  extraInnerStyle: string;
} {
  let children = Array.isArray(liNode.children) ? [...liNode.children] : [];
  let extraInnerStyle = "";

  if (
    children.length === 1 &&
    (children[0].tag || "").trim().toLowerCase() === "div" &&
    !(children[0].class || "").trim() &&
    !(children[0].text || "").trim() &&
    !isImageWrapperNode(children[0]) &&
    !isSvgDonorNode(children[0])
  ) {
    extraInnerStyle = children[0].style || "";
    children = Array.isArray(children[0].children)
      ? [...children[0].children]
      : [];
  }

  return { children, extraInnerStyle };
}

function ensureLiNode(node: HtmlNode): HtmlNode {
  if ((node.tag || "").trim().toLowerCase() === "li") {
    return node;
  }

  const { outerStyle, innerStyle } = splitLiStyles(node.style);
  const innerNode: HtmlNode = {
    ...node,
    style: innerStyle,
  };

  return {
    tag: "li",
    text: "",
    class: "",
    style: outerStyle,
    children: [innerNode],
    _key: makeNodeKey("li"),
  };
}

export function applyListItemPresetToUl(
  ulNode: HtmlNode,
  preset?: ListItemPreset,
): HtmlNode {
  if (!preset || preset === "none" || !Array.isArray(ulNode.children)) {
    return ulNode;
  }

  const nextChildren = ulNode.children.map((rawChild) => {
    const child = ensureLiNode(rawChild);

    const { outerStyle, innerStyle: liInnerStyle } = splitLiStyles(child.style);
    const { children: rawItems, extraInnerStyle } =
      unwrapSingleSyntheticWrapper(child);
    const innerStyle = mergeInlineStyles(liInnerStyle, extraInnerStyle);

    const workingItems: HtmlNode[] =
      rawItems.length === 0 && child.text && child.text.trim()
        ? [
            {
              tag: "span",
              text: child.text,
              class: child.class || "",
              style: "",
              children: [],
              _key: makeNodeKey("txt"),
            },
          ]
        : rawItems;

    const iconIdx = workingItems.findIndex(
      (n) => isSvgDonorNode(n) || (n.tag || "").trim().toLowerCase() === "i",
    );
    const textIdx = workingItems.findIndex(
      (n, idx) => idx !== iconIdx && isTextLikeNode(n),
    );

    const iconSource = iconIdx !== -1 ? workingItems[iconIdx] : undefined;
    const textSource = textIdx !== -1 ? workingItems[textIdx] : undefined;
    const restItems = workingItems.filter(
      (_, idx) => idx !== iconIdx && idx !== textIdx,
    );

    if (preset === "a") {
      if (
        workingItems.length === 1 &&
        (workingItems[0].tag || "").trim().toLowerCase() === "a"
      ) {
        const existingA = workingItems[0];
        return {
          ...child,
          text: "",
          style: outerStyle,
          children: [
            {
              ...existingA,
              style: mergeInlineStyles(innerStyle, existingA.style),
              attributes: {
                href: "#",
                ...(existingA.attributes || {}),
              },
            },
          ],
        };
      }

      if (textSource && !iconSource && restItems.length === 0) {
        return {
          ...child,
          text: "",
          style: outerStyle,
          children: [
            {
              ...textSource,
              tag: "a",
              style: mergeInlineStyles(innerStyle, textSource.style),
              attributes: {
                href: "#",
                ...(textSource.attributes || {}),
              },
              _key: textSource._key || makeNodeKey("a"),
            },
          ],
        };
      }

      return {
        ...child,
        text: "",
        style: outerStyle,
        children: [
          {
            tag: "a",
            text: "",
            class: "",
            style: innerStyle,
            attributes: { href: "#" },
            children: workingItems,
            _key: makeNodeKey("a"),
          },
        ],
      };
    }

    if (preset === "a-i") {
      const iNode = normalizeToIconNode(iconSource);
      const aChildren: HtmlNode[] = [iNode, ...restItems];
      const aText = textSource?.text || "";
      const aStyle = mergeInlineStyles(
        aText ? "display: flex; align-items: center;" : "",
        mergeInlineStyles(innerStyle, textSource?.style),
      );

      return {
        ...child,
        text: "",
        style: outerStyle,
        children: [
          {
            tag: "a",
            text: aText,
            class: textSource?.class || "",
            style: aStyle,
            attributes: { href: "#" },
            children: aChildren,
            _key: makeNodeKey("a"),
          },
        ],
      };
    }

    if (preset === "i-span") {
      const iNode = normalizeToIconNode(iconSource);
      const spanNode = normalizeToSpanNode(textSource);
      const liFlexStyle = mergeInlineStyles(
        "display: flex; align-items: center;",
        mergeInlineStyles(outerStyle, innerStyle),
      );

      return {
        ...child,
        text: "",
        style: liFlexStyle,
        children: [iNode, spanNode, ...restItems],
      };
    }

    const iNode = normalizeToIconNode(iconSource);
    const spanNode = normalizeToSpanNode(textSource);
    const aStyle = mergeInlineStyles(
      "display: flex; align-items: center;",
      innerStyle,
    );

    return {
      ...child,
      text: "",
      style: outerStyle,
      children: [
        {
          tag: "a",
          text: "",
          class: "",
          style: aStyle,
          attributes: { href: "#" },
          children: [iNode, spanNode, ...restItems],
          _key: makeNodeKey("a"),
        },
      ],
    };
  });

  return {
    ...ulNode,
    children: nextChildren,
  };
}

// ─── Строгая сигнатура свойств нод и распознавание повторяющихся частей ───

const IDENTITY_STYLE_PROPS = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-decoration",
  "text-align",
  "color",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-width",
  "border-radius",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
]);

function normalizeStyleSignature(style?: string): string {
  if (!style || !style.trim()) return "";
  const map = new Map<string, string>();
  for (const raw of style.split(";")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const prop = trimmed.slice(0, idx).trim().toLowerCase();
    const val = trimmed
      .slice(idx + 1)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (prop && val && IDENTITY_STYLE_PROPS.has(prop)) {
      map.set(prop, val);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function normalizeClassSignature(cls?: string): string {
  if (!cls || !cls.trim()) return "";
  return cls
    .trim()
    .split(/\s+/)
    .filter((c) => c && !c.startsWith("section-"))
    .sort()
    .join(".");
}

function getSizeBucket(w: number, h: number): string {
  // Грубая корзина размеров для SVG/картинок, чтобы иконка 24px и баннер 600px не считались одинаковыми
  const maxDim = Math.max(w, h);
  if (maxDim <= 48) return "xs";
  if (maxDim <= 120) return "sm";
  if (maxDim <= 320) return "md";
  return "lg";
}

export function getLayoutNodeSignature(node: LayoutNode): string {
  if (node.entry.isImageBlock) {
    return `img[${getSizeBucket(node.rect.width, node.rect.height)}]`;
  }
  if (node.entry.isSvgShape && node.children.length === 0) {
    return `svg[${getSizeBucket(node.rect.width, node.rect.height)}]`;
  }
  if (node.children.length > 0) {
    const childSigs = node.children.map(getLayoutNodeSignature).join(",");
    return `box(${childSigs})`;
  }

  const tag = (node.box.tag || node.entry.tag || "div").toLowerCase();
  const cls = normalizeClassSignature(node.entry.node.class);
  const css = normalizeStyleSignature(node.box.style || node.entry.node.style);
  return `${tag}|${cls}|${css}`;
}

function getBandSignature(band: LayoutNode[]): string {
  if (band.length === 1) {
    return getLayoutNodeSignature(band[0]);
  }
  // Внутри одной полосы сортируем элементы по X (или Y) для стабильной сигнатуры
  const sorted = [...band].sort(
    (a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y,
  );
  return `row(${sorted.map(getLayoutNodeSignature).join("+")})`;
}

// ─── Группировка по полосам и анализ зазоров ───────────────────────────────

export function splitIntoBands(
  items: LayoutNode[],
  axis: "y" | "x",
): LayoutNode[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) =>
    axis === "y"
      ? a.rect.y - b.rect.y || a.rect.x - b.rect.x
      : a.rect.x - b.rect.x || a.rect.y - b.rect.y,
  );

  const bands: LayoutNode[][] = [];
  let currentBand: LayoutNode[] = [sorted[0]];
  let bandEnd =
    axis === "y"
      ? sorted[0].rect.y + sorted[0].rect.height
      : sorted[0].rect.x + sorted[0].rect.width;
  let bandStart = axis === "y" ? sorted[0].rect.y : sorted[0].rect.x;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const start = axis === "y" ? item.rect.y : item.rect.x;
    const size = axis === "y" ? item.rect.height : item.rect.width;
    const end = start + size;

    const isThinDivider = size <= 4;
    const overlap = Math.min(bandEnd, end) - Math.max(bandStart, start);

    if (!isThinDivider && overlap > 2) {
      currentBand.push(item);
      if (end > bandEnd) bandEnd = end;
    } else if (isThinDivider && start > bandStart + 2 && end < bandEnd - 2) {
      currentBand.push(item);
    } else {
      bands.push(currentBand);
      currentBand = [item];
      bandStart = start;
      bandEnd = end;
    }
  }
  bands.push(currentBand);

  return bands;
}

export function measureBandGaps(
  bands: LayoutNode[][],
  axis: "x" | "y",
  scale: number,
): number[] {
  if (bands.length < 2) return [];
  const rects = bands.map((b) => computeBoundingRect(b));
  const gaps: number[] = [];
  const s = scale || 1;

  for (let i = 0; i < rects.length - 1; i++) {
    const gap =
      axis === "x"
        ? (rects[i + 1].x - (rects[i].x + rects[i].width)) / s
        : (rects[i + 1].y - (rects[i].y + rects[i].height)) / s;
    gaps.push(Math.max(0, Math.round(gap)));
  }
  return gaps;
}

export function medianGap(gaps: number[]): number {
  if (gaps.length === 0) return 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function splitByLargeGaps(
  items: LayoutNode[],
  axis: "x" | "y",
  gapThresholdPx: number,
  scale: number,
): LayoutNode[][] {
  const bands = splitIntoBands(items, axis);
  if (bands.length <= 1) return bands;

  const gaps = measureBandGaps(bands, axis, scale);
  const groups: LayoutNode[][] = [];
  let current: LayoutNode[] = [...bands[0]];

  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i] > gapThresholdPx) {
      groups.push(current);
      current = [...bands[i + 1]];
    } else {
      current.push(...bands[i + 1]);
    }
  }
  groups.push(current);
  return groups;
}

export interface BlockProfile {
  isComposite: boolean;
  leafCount: number;
  imgCount: number;
  svgCount: number;
  textCount: number;
  width: number;
  height: number;
  fontClass: string;
  tag: string;
  signature: string;
}

export function getGroupProfile(nodes: LayoutNode[]): BlockProfile {
  let imgCount = 0;
  let svgCount = 0;
  let textCount = 0;

  function countNode(n: LayoutNode) {
    if (n.entry.isImageBlock) {
      imgCount++;
      return;
    }
    if (n.children.length > 0) {
      for (const ch of n.children) countNode(ch);
      return;
    }
    if (n.entry.isSvgShape) {
      if (n.entry.width > 4 && n.entry.height > 4) svgCount++;
    } else {
      textCount++;
    }
  }

  for (const n of nodes) countNode(n);
  const leafCount = imgCount + svgCount + textCount;
  const rect = computeBoundingRect(nodes);

  let fontClass = "";
  let tag = "";
  if (nodes.length === 1 && nodes[0].children.length === 0) {
    tag = nodes[0].entry.isImageBlock
      ? "img"
      : nodes[0].entry.isSvgShape
        ? "svg"
        : nodes[0].entry.tag;
    const classes = (nodes[0].entry.node.class || "").split(/\s+/);
    fontClass = classes.find((c) => c.startsWith("font-")) || "";
  }

  return {
    isComposite:
      leafCount >= 2 ||
      (nodes.length === 1 &&
        nodes[0].isExplicitContainer &&
        nodes[0].children.length >= 1),
    leafCount,
    imgCount,
    svgCount,
    textCount,
    width: rect.width,
    height: rect.height,
    fontClass,
    tag,
    signature: getBandSignature(nodes),
  };
}

function areChunkBoundsCompatible(
  chunks: LayoutNode[][],
  direction: "row" | "column",
  isComposite: boolean,
  scale: number,
): boolean {
  if (chunks.length < 2) return false;
  const s = scale || 1;
  const rects = chunks.map((c) => computeBoundingRect(c));

  // 1. Проверяем равномерность интервалов между повторениями
  const gaps: number[] = [];
  for (let i = 0; i < rects.length - 1; i++) {
    const g =
      direction === "row"
        ? (rects[i + 1].x - (rects[i].x + rects[i].width)) / s
        : (rects[i + 1].y - (rects[i].y + rects[i].height)) / s;
    gaps.push(Math.max(0, g));
  }
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);
  if (gaps.length >= 2 && maxGap > Math.max(16, minGap * 1.8 + 8)) {
    return false;
  }

  // 2. Для одиночных текстовых нод: строгое выравнивание по ортогональной оси
  //    (и исключаем широкие многострочные абзацы в колонке)
  if (!isComposite) {
    if (direction === "column") {
      const lefts = rects.map((r) => r.x / s);
      const centers = rects.map((r) => (r.x + r.width / 2) / s);
      const leftSpread = Math.max(...lefts) - Math.min(...lefts);
      const centerSpread = Math.max(...centers) - Math.min(...centers);
      if (leftSpread > 12 && centerSpread > 12) {
        return false;
      }

      const avgH =
        rects.reduce((sum, r) => sum + r.height, 0) / rects.length / s;
      const avgW =
        rects.reduce((sum, r) => sum + r.width, 0) / rects.length / s;
      if (avgH > 42 || (avgW > 460 && chunks.length < 4)) {
        return false;
      }
    } else {
      const centersY = rects.map((r) => (r.y + r.height / 2) / s);
      const tops = rects.map((r) => r.y / s);
      const centerSpread = Math.max(...centersY) - Math.min(...centersY);
      const topSpread = Math.max(...tops) - Math.min(...tops);
      if (centerSpread > 12 && topSpread > 12) {
        return false;
      }
    }
    return true;
  }

  // 3. Для повторяющихся составных блоков: проверяем сопоставимость размеров
  const widths = rects.map((r) => r.width);
  const heights = rects.map((r) => r.height);
  const wRatio = Math.max(...widths) / Math.max(1, Math.min(...widths));
  const hRatio = Math.max(...heights) / Math.max(1, Math.min(...heights));
  const maxW = chunks.length === 2 ? 1.25 : 1.4;
  const maxH = chunks.length === 2 ? 1.35 : 1.55;
  return wRatio <= maxW && hRatio <= maxH;
}

/**
 * Распознаёт:
 * 1) Точно-одинаковые листовые элементы (частный случай — ссылки/теги с 100% одинаковыми свойствами)
 * 2) Повторяющиеся части макета любой длины L = 1..4 полос (например [Icon+H3] + [P], повторенные N раз)
 */
export function groupIntoUniformRuns(
  groups: LayoutNode[][],
  direction: "row" | "column",
  scale: number,
): {
  isList: boolean;
  items: LayoutNode[][];
}[] {
  if (groups.length < 2) {
    return groups.map((g) => ({ isList: false, items: [g] }));
  }

  const bandSigs = groups.map((g) => getBandSignature(g));
  const profiles = groups.map((g) => getGroupProfile(g));
  const runs: { isList: boolean; items: LayoutNode[][] }[] = [];

  let i = 0;
  while (i < groups.length) {
    let matchedMotif: {
      period: number;
      repeats: number;
      chunks: LayoutNode[][];
    } | null = null;

    // Пробуем найти повторяющийся паттерн длиной L = 1..4 полосы
    const maxPeriod = Math.min(4, Math.floor((groups.length - i) / 2));
    for (let L = 1; L <= maxPeriod; L++) {
      let repeats = 1;
      while (i + (repeats + 1) * L <= groups.length) {
        let samePeriod = true;
        for (let offset = 0; offset < L; offset++) {
          if (bandSigs[i + offset] !== bandSigs[i + repeats * L + offset]) {
            samePeriod = false;
            break;
          }
        }
        if (!samePeriod) break;
        repeats++;
      }

      const isSingleLeafPeriod = L === 1 && !profiles[i].isComposite;
      const firstTag = profiles[i].tag;
      const isActionTag = firstTag === "a" || firstTag === "button";
      // Для одиночных текстов без <a>/<button> требуем >= 3 абсолютно одинаковых элементов
      // (или >= 2, если это явные ссылки/кнопки либо составные/многополосные блоки)
      const minRepeats = isSingleLeafPeriod && !isActionTag ? 3 : 2;

      if (repeats < minRepeats) continue;

      const chunks: LayoutNode[][] = [];
      for (let r = 0; r < repeats; r++) {
        chunks.push(groups.slice(i + r * L, i + (r + 1) * L).flat());
      }

      const isCompositeChunk = L > 1 || profiles[i].isComposite;
      if (
        !areChunkBoundsCompatible(chunks, direction, isCompositeChunk, scale)
      ) {
        continue;
      }

      // Для L > 1 проверяем, что зазор ВНУТРИ блока не больше зазора МЕЖДУ блоками
      if (L > 1) {
        const s = scale || 1;
        const firstSlice = groups.slice(i, i + L);
        const innerGaps = measureBandGaps(
          firstSlice,
          direction === "row" ? "x" : "y",
          s,
        );
        const maxInnerGap = innerGaps.length > 0 ? Math.max(...innerGaps) : 0;
        const chunkRects = chunks.map((c) => computeBoundingRect(c));
        const betweenGap =
          direction === "row"
            ? (chunkRects[1].x - (chunkRects[0].x + chunkRects[0].width)) / s
            : (chunkRects[1].y - (chunkRects[0].y + chunkRects[0].height)) / s;
        if (betweenGap + 2 < maxInnerGap) {
          continue;
        }
      }

      matchedMotif = { period: L, repeats, chunks };
      break;
    }

    if (matchedMotif) {
      runs.push({ isList: true, items: matchedMotif.chunks });
      i += matchedMotif.period * matchedMotif.repeats;
    } else {
      runs.push({ isList: false, items: [groups[i]] });
      i += 1;
    }
  }

  return runs;
}

export function hasUniformBlocks(
  groups: LayoutNode[][],
  direction: "row" | "column",
  scale: number,
): boolean {
  if (groups.length < 2) return false;
  const runs = groupIntoUniformRuns(groups, direction, scale);
  return runs.some((r) => r.isList);
}

export function isInternalUniformList(
  group: LayoutNode[],
  innerDirection: "column" | "row",
  scale: number,
): boolean {
  if (group.length < 2) return false;
  const axis = innerDirection === "column" ? "y" : "x";
  const subBands = splitIntoBands(group, axis);
  if (subBands.length < 2) return false;
  const runs = groupIntoUniformRuns(subBands, innerDirection, scale);
  return runs.length === 1 && runs[0].isList;
}

export function detectUniformCardGrid(
  yBands: LayoutNode[][],
  scale: number,
): { cells: LayoutNode[][]; gapX: number; gapY: number } | null {
  if (yBands.length < 2) return null;

  const rowCells = yBands.map((band) => splitIntoBands(band, "x"));
  const firstRowCount = rowCells[0].length;
  if (firstRowCount < 2) return null;

  for (let r = 0; r < rowCells.length; r++) {
    const len = rowCells[r].length;
    if (r < rowCells.length - 1 && len < 2) return null;
    if (len > firstRowCount) return null;
  }

  const allCells = rowCells.flat();
  if (allCells.length < 4) return null;

  const anchorSig = getBandSignature(allCells[0]);
  const anchorProfile = getGroupProfile(allCells[0]);
  const isCardOrVisual =
    anchorProfile.isComposite ||
    anchorProfile.imgCount > 0 ||
    anchorProfile.svgCount > 0;
  if (!isCardOrVisual) return null;

  for (let i = 1; i < allCells.length; i++) {
    if (getBandSignature(allCells[i]) !== anchorSig) {
      return null;
    }
  }

  const xGaps: number[] = [];
  for (const row of rowCells) {
    const rects = row.map((cell) => computeBoundingRect(cell));
    for (let i = 0; i < rects.length - 1; i++) {
      const g = Math.round(
        (rects[i + 1].x - (rects[i].x + rects[i].width)) / (scale || 1),
      );
      if (g >= 0) xGaps.push(g);
    }
  }

  const rowRects = yBands.map((b) => computeBoundingRect(b));
  const yGaps: number[] = [];
  for (let i = 0; i < rowRects.length - 1; i++) {
    const g = Math.round(
      (rowRects[i + 1].y - (rowRects[i].y + rowRects[i].height)) / (scale || 1),
    );
    if (g >= 0) yGaps.push(g);
  }

  const avg = (arr: number[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
      : 0;

  return {
    cells: allCells,
    gapX: avg(xGaps),
    gapY: avg(yGaps),
  };
}

export function computeFlexStyle(
  items: { rect: LayoutRect }[],
  direction: "row" | "column",
  scale: number,
  existingStyle?: string,
): string {
  const sorted =
    direction === "row"
      ? [...items].sort((a, b) => a.rect.x - b.rect.x)
      : [...items].sort((a, b) => a.rect.y - b.rect.y);

  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const g =
      direction === "row"
        ? Math.round(
            (sorted[i + 1].rect.x - (sorted[i].rect.x + sorted[i].rect.width)) /
              (scale || 1),
          )
        : Math.round(
            (sorted[i + 1].rect.y -
              (sorted[i].rect.y + sorted[i].rect.height)) /
              (scale || 1),
          );
    if (g >= 0) gaps.push(g);
  }

  const flexParts = ["display: flex", `flex-direction: ${direction}`];

  if (direction === "row") {
    const centers = sorted.map((c) => c.rect.y + c.rect.height / 2);
    const maxCenterDiff =
      (Math.max(...centers) - Math.min(...centers)) / (scale || 1);
    const alignItems = maxCenterDiff <= 4 ? "center" : "flex-start";
    flexParts.push(`align-items: ${alignItems}`);
  }

  if (gaps.length > 0) {
    const minGap = Math.min(...gaps);
    const maxGap = Math.max(...gaps);
    if (maxGap - minGap <= 6) {
      const avgGap = Math.round(
        gaps.reduce((sum, v) => sum + v, 0) / gaps.length,
      );
      if (avgGap > 0) {
        flexParts.push(`gap: ${avgGap}px`);
      }
    }
  }

  return mergeInlineStyles(existingStyle, `${flexParts.join("; ")};`);
}
