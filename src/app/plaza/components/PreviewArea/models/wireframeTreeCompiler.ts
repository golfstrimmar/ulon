import type { HtmlNode } from "@/types/HtmlNode";
import { generateNodeKey } from "@/store/htmlTree";
import {
  applyBemClassesToSection,
  applyDonorToSlot,
  getNodeKey,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import {
  resolveHeadingTagByFontSize,
  type ColorVariableMap,
} from "@/app/design/models/figmaTextNode.model";
import {
  canBeParentContainer,
  computeBoundingRect,
  formatCssBoxSpacing,
  getBoxSortPriority,
  isContained,
  isImageWrapperNode,
  mergeInlineStyles,
  stripFigmaAttributes,
  type IntermediateNode,
  type ListDirection,
  type ListItemPreset,
  type OverlayMetrics,
  type WireframeBox,
} from "./wireframeTypes";
import { isSvgDonorNode } from "@/app/plaza/components/PreviewArea/models/wireframeFigmaCollector";
import { applyListItemPresetToUl } from "@/app/plaza/components/PreviewArea/models/wireframeListPresets";

export {
  isImageWrapperNode,
  type ListDirection,
  type ListItemPreset,
  type OverlayMetrics,
  type WireframeBox,
} from "./wireframeTypes";
export { countFigmaNodesInTree } from "./wireframeFigmaCollector";
export { buildWireframeBoxesFromTree } from "./wireframeBoxBuilder";

// ─── Повышение текстов с толщиной >= 500 до заголовков h2-h6 ────────────────

function extractFontWeightNumber(style?: string, className?: string): number {
  if (style) {
    const match = /font-weight\s*:\s*([^;]+)/i.exec(style);
    if (match) {
      const raw = match[1].trim().toLowerCase();
      if (raw === "bold" || raw === "bolder") return 700;
      if (raw === "medium") return 500;
      if (raw === "normal" || raw === "lighter") return 400;
      const num = parseFloat(raw);
      if (!isNaN(num)) return num;
    }
  }

  if (className) {
    const tokens = className.toLowerCase().split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (t === "font-black") return 900;
      if (t === "font-extrabold") return 800;
      if (t === "font-bold") return 700;
      if (t === "font-semibold") return 600;
      if (t === "font-medium") return 500;
      const m = /(?:^|-)([5-9]00)(?:-|$)/.exec(t);
      if (m) return parseInt(m[1], 10);
    }
  }

  return 400;
}

function extractFontSizeNumber(
  style?: string,
  className?: string,
): number | undefined {
  if (style) {
    const match = /font-size\s*:\s*([\d.]+)\s*px/i.exec(style);
    if (match) {
      const n = parseFloat(match[1]);
      if (!isNaN(n) && n > 0) return n;
    }
  }

  if (className) {
    const tokens = className.toLowerCase().split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (!t.startsWith("font-") && !t.startsWith("text-")) continue;
      const parts = t.split("-");
      for (const p of parts) {
        if (/^\d{2}$/.test(p)) {
          const n = parseInt(p, 10);
          if (n >= 10 && n <= 96) return n;
        }
      }
    }
  }

  return undefined;
}

function promoteBoldTextTagIfNeeded(
  node: HtmlNode,
  fallbackStyle?: string,
): HtmlNode {
  const tag = (node.tag || "").trim().toLowerCase();
  if (/^h[1-6]$/.test(tag)) return node;

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  if (hasChildren) return node;

  if (tag !== "" && tag !== "p" && tag !== "span") {
    return node;
  }

  const combinedStyle = mergeInlineStyles(fallbackStyle, node.style);
  const weight = extractFontWeightNumber(combinedStyle, node.class);
  if (weight >= 500) {
    const fontSize = extractFontSizeNumber(combinedStyle, node.class);
    return {
      ...node,
      tag: resolveHeadingTagByFontSize(fontSize),
    };
  }

  return node;
}

// ─── Перегруппировка элементов <ul> по явному выбору направления из модалки ─

function isSyntheticWrapperNode(node: IntermediateNode): boolean {
  if (node.box.donorKey || (node.box.consumedDonorKeys?.length || 0) > 0) {
    return false;
  }
  return (
    node.box.id.startsWith("li_box") ||
    node.box.id.startsWith("li_dir") ||
    node.box.id.startsWith("col_box") ||
    node.box.id.startsWith("row_box") ||
    node.box.id.startsWith("ul_box")
  );
}

function unwrapUlItems(children: IntermediateNode[]): IntermediateNode[] {
  const result: IntermediateNode[] = [];
  for (const ch of children) {
    if (isSyntheticWrapperNode(ch) && ch.children.length > 0) {
      result.push(...unwrapUlItems(ch.children));
    } else if (!isSyntheticWrapperNode(ch)) {
      result.push(ch);
    }
  }
  return result;
}

function isMediaOrIconNode(
  node: IntermediateNode,
  donorMap?: Map<string, HtmlNode>,
): boolean {
  const explicitTag = (node.box.tag || "").trim().toLowerCase();
  if (explicitTag === "img" || explicitTag === "svg" || explicitTag === "i") {
    return true;
  }
  if (node.box.donorKey && donorMap) {
    const donor = donorMap.get(node.box.donorKey);
    if (!donor) return false;
    if (isImageWrapperNode(donor) || isSvgDonorNode(donor)) return true;
    const dTag = (donor.tag || "").trim().toLowerCase();
    if (dTag === "img" || dTag === "svg" || dTag === "i") return true;
  }
  return false;
}

function rectGapDistance(
  a: WireframeBox,
  b: WireframeBox,
): { dx: number; dy: number; dist: number } {
  const dx = Math.max(
    0,
    Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width),
  );
  const dy = Math.max(
    0,
    Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height),
  );
  return { dx, dy, dist: Math.hypot(dx, dy) };
}

function removeStyleProps(style: string, propsToRemove: string[]): string {
  if (!style.trim()) return "";
  const drop = new Set(propsToRemove.map((p) => p.toLowerCase()));
  const kept: string[] = [];
  for (const raw of style.split(";")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const prop = trimmed.slice(0, idx).trim().toLowerCase();
    const val = trimmed.slice(idx + 1).trim();
    if (prop && val && !drop.has(prop)) {
      kept.push(`${prop}: ${val}`);
    }
  }
  return kept.length > 0 ? `${kept.join("; ")};` : "";
}

function wrapGroupIntoLi(
  group: IntermediateNode[],
  ulNode: IntermediateNode,
  scale: number,
): IntermediateNode {
  if (group.length === 1 && group[0].children.length > 0) {
    const single = group[0];
    single.box.tag = "li";
    single.parent = ulNode;
    return single;
  }

  const rect = computeBoundingRect(group.map((g) => ({ rect: g.box })));
  const liBox: WireframeBox = {
    id: `li_dir_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    scale,
    tag: "li",
    sortPriority: 1,
  };

  let liStyle = "";
  const orderedGroup = [...group];

  if (group.length === 2) {
    const { dx, dy } = rectGapDistance(group[0].box, group[1].box);
    if (dy === 0 || dx > dy) {
      orderedGroup.sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y);
      const gapPx = Math.max(0, Math.round(dx / (scale || 1)));
      liStyle =
        gapPx > 0
          ? `display: flex; flex-direction: row; align-items: center; gap: ${gapPx}px;`
          : "display: flex; flex-direction: row; align-items: center;";
    } else {
      orderedGroup.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
      const gapPx = Math.max(0, Math.round(dy / (scale || 1)));
      liStyle =
        gapPx > 0
          ? `display: flex; flex-direction: column; gap: ${gapPx}px;`
          : "display: flex; flex-direction: column;";
    }
  }

  const liNode: IntermediateNode = {
    box: liBox,
    children: orderedGroup,
    parent: ulNode,
    computedStyle: liStyle,
  };

  for (const child of orderedGroup) {
    child.parent = liNode;
  }

  return liNode;
}

function buildOneTextPerLiNodes(
  items: IntermediateNode[],
  ulNode: IntermediateNode,
  direction: "row" | "column" | "wrap",
  scale: number,
  donorMap?: Map<string, HtmlNode>,
): IntermediateNode[] {
  const containerItems: IntermediateNode[] = [];
  const textItems: IntermediateNode[] = [];
  const mediaItems: IntermediateNode[] = [];

  for (const item of items) {
    if (item.children.length > 0) {
      containerItems.push(item);
    } else if (isMediaOrIconNode(item, donorMap)) {
      mediaItems.push(item);
    } else {
      textItems.push(item);
    }
  }

  const groups: IntermediateNode[][] = containerItems.map((c) => [c]);

  if (textItems.length === 0) {
    for (const m of mediaItems) {
      groups.push([m]);
    }
  } else {
    const maxPairDist = 80 * (scale || 1);
    const candidates: { mIdx: number; tIdx: number; dist: number }[] = [];

    for (let mIdx = 0; mIdx < mediaItems.length; mIdx++) {
      for (let tIdx = 0; tIdx < textItems.length; tIdx++) {
        const { dist } = rectGapDistance(
          mediaItems[mIdx].box,
          textItems[tIdx].box,
        );
        if (dist <= maxPairDist) {
          candidates.push({ mIdx, tIdx, dist });
        }
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);

    const usedMedia = new Set<number>();
    const pairedMediaForText = new Map<number, IntermediateNode>();

    for (const c of candidates) {
      if (usedMedia.has(c.mIdx) || pairedMediaForText.has(c.tIdx)) continue;
      usedMedia.add(c.mIdx);
      pairedMediaForText.set(c.tIdx, mediaItems[c.mIdx]);
    }

    for (let tIdx = 0; tIdx < textItems.length; tIdx++) {
      const media = pairedMediaForText.get(tIdx);
      groups.push(media ? [media, textItems[tIdx]] : [textItems[tIdx]]);
    }

    for (let mIdx = 0; mIdx < mediaItems.length; mIdx++) {
      if (!usedMedia.has(mIdx)) {
        groups.push([mediaItems[mIdx]]);
      }
    }
  }

  const liNodes = groups.map((g) => wrapGroupIntoLi(g, ulNode, scale));

  if (direction === "row") {
    liNodes.sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y);
  } else {
    liNodes.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  }

  return liNodes;
}

function measureUniformGap(
  liNodes: IntermediateNode[],
  axis: "x" | "y",
  scale: number,
): number {
  if (liNodes.length < 2) return 0;
  const gaps: number[] = [];
  for (let i = 0; i < liNodes.length - 1; i++) {
    const a = liNodes[i].box;
    const b = liNodes[i + 1].box;
    const g =
      axis === "x"
        ? (b.x - (a.x + a.width)) / (scale || 1)
        : (b.y - (a.y + a.height)) / (scale || 1);
    if (g >= 0) gaps.push(Math.round(g));
  }
  if (gaps.length === 0) return 0;
  return Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length);
}

function applyManualDirectionToUls(
  nodes: IntermediateNode[],
  donorMap?: Map<string, HtmlNode>,
) {
  function walk(node: IntermediateNode) {
    for (const ch of node.children) {
      walk(ch);
    }

    const dir: ListDirection | undefined = node.box.listDirection;
    const isUl = (node.box.tag || "").trim().toLowerCase() === "ul";
    if (!isUl || !dir || dir === "auto" || node.children.length === 0) {
      return;
    }

    const scale = node.box.scale || 1;
    const items = unwrapUlItems(node.children);
    if (items.length === 0) return;

    for (const item of items) {
      item.computedStyle = removeStyleProps(item.computedStyle || "", [
        "margin-right",
        "margin-bottom",
        "margin-top",
        "margin-left",
        "flex",
      ]);
    }

    const baseUlStyle = removeStyleProps(node.computedStyle || "", [
      "flex-direction",
      "flex-wrap",
      "gap",
    ]);

    const liNodes = buildOneTextPerLiNodes(items, node, dir, scale, donorMap);
    node.children = liNodes;

    if (dir === "row") {
      const measuredGap = measureUniformGap(liNodes, "x", scale);
      const gap = measuredGap > 0 ? measuredGap : 16;
      node.computedStyle = mergeInlineStyles(
        baseUlStyle,
        `display: flex; flex-direction: row; align-items: center; gap: ${gap}px;`,
      );
    } else if (dir === "column") {
      const measuredGap = measureUniformGap(liNodes, "y", scale);
      const gap = measuredGap > 0 ? measuredGap : 12;
      node.computedStyle = mergeInlineStyles(
        baseUlStyle,
        `display: flex; flex-direction: column; gap: ${gap}px;`,
      );
    } else if (dir === "wrap") {
      const gx = measureUniformGap(liNodes, "x", scale) || 16;
      const gy = measureUniformGap(liNodes, "y", scale) || 16;
      const gapCss = gx === gy ? `gap: ${gx}px;` : `gap: ${gy}px ${gx}px;`;
      node.computedStyle = mergeInlineStyles(
        baseUlStyle,
        `display: flex; flex-direction: row; flex-wrap: wrap; align-items: stretch; ${gapCss}`,
      );
    }
  }

  for (const root of nodes) {
    walk(root);
  }
}

function applySpacingToTree(nodes: IntermediateNode[]) {
  const NOISE_THRESHOLD = 2;
  const cleanPx = (rawPx: number, scale: number): number => {
    const v = Math.round(rawPx / (scale || 1));
    return v > NOISE_THRESHOLD ? v : 0;
  };

  function processNode(node: IntermediateNode, isRoot: boolean) {
    if (node.children.length === 0) return;

    for (const child of node.children) {
      processNode(child, false);
    }

    const scale = node.box.scale || 1;
    const isManualDir = Boolean(
      node.box.listDirection && node.box.listDirection !== "auto",
    );
    const isFlexRow = Boolean(
      node.computedStyle &&
      /display\s*:\s*flex/i.test(node.computedStyle) &&
      !/flex-direction\s*:\s*column/i.test(node.computedStyle),
    );
    const isFlexWrap = Boolean(
      node.computedStyle && /flex-wrap\s*:\s*wrap/i.test(node.computedStyle),
    );
    const hasParentGap = Boolean(
      node.computedStyle && /(?:^|;)\s*gap\s*:/i.test(node.computedStyle),
    );

    let minChildX = Infinity;
    let minChildY = Infinity;
    let maxChildRight = -Infinity;
    let maxChildBottom = -Infinity;

    for (const ch of node.children) {
      if (ch.box.x < minChildX) minChildX = ch.box.x;
      if (ch.box.y < minChildY) minChildY = ch.box.y;
      if (ch.box.x + ch.box.width > maxChildRight) {
        maxChildRight = ch.box.x + ch.box.width;
      }
      if (ch.box.y + ch.box.height > maxChildBottom) {
        maxChildBottom = ch.box.y + ch.box.height;
      }
    }

    const padTop = cleanPx(minChildY - node.box.y, scale);
    let padLeft = cleanPx(minChildX - node.box.x, scale);
    let padRight = cleanPx(node.box.x + node.box.width - maxChildRight, scale);
    const padBottom = cleanPx(
      node.box.y + node.box.height - maxChildBottom,
      scale,
    );

    const rootWidth1x = Math.round(node.box.width / (scale || 1));
    if (isRoot && rootWidth1x >= 1440 && padLeft > 120 && padRight > 120) {
      padLeft = 0;
      padRight = 0;
    }

    const paddingCss = formatCssBoxSpacing(
      "padding",
      padTop,
      padRight,
      padBottom,
      padLeft,
    );
    if (paddingCss) {
      node.computedStyle = mergeInlineStyles(node.computedStyle, paddingCss);
    }

    if (node.children.length >= 2) {
      if (isFlexWrap) {
        node.children.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
      } else if (isFlexRow) {
        node.children.sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y);

        const alignIsCenter = Boolean(
          node.computedStyle &&
          /align-items\s*:\s*center/i.test(node.computedStyle),
        );

        for (let i = 0; i < node.children.length; i++) {
          const cur = node.children[i];
          const childScale = cur.box.scale || scale;

          if (!hasParentGap && i < node.children.length - 1) {
            const next = node.children[i + 1];
            const gapX = cleanPx(
              next.box.x - (cur.box.x + cur.box.width),
              childScale,
            );
            if (gapX > 0) {
              cur.computedStyle = mergeInlineStyles(
                cur.computedStyle,
                `margin-right: ${gapX}px;`,
              );
            }
          }

          if (!alignIsCenter && !isManualDir) {
            const topOffset = cleanPx(cur.box.y - minChildY, childScale);
            if (topOffset > 4) {
              cur.computedStyle = mergeInlineStyles(
                cur.computedStyle,
                `margin-top: ${topOffset}px;`,
              );
            }
          }
        }
      } else {
        node.children.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);

        for (let i = 0; i < node.children.length; i++) {
          const cur = node.children[i];
          const childScale = cur.box.scale || scale;

          if (!hasParentGap && i < node.children.length - 1) {
            const next = node.children[i + 1];
            const gapY = cleanPx(
              next.box.y - (cur.box.y + cur.box.height),
              childScale,
            );
            if (gapY > 0) {
              cur.computedStyle = mergeInlineStyles(
                cur.computedStyle,
                `margin-bottom: ${gapY}px;`,
              );
            }
          }

          if (!isManualDir) {
            const leftOffset = cleanPx(cur.box.x - minChildX, childScale);
            if (leftOffset > 4) {
              cur.computedStyle = mergeInlineStyles(
                cur.computedStyle,
                `margin-left: ${leftOffset}px;`,
              );
            }
          }
        }
      }
    }
  }

  if (nodes.length >= 2) {
    const sortedRoots = [...nodes].sort(
      (a, b) => a.box.y - b.box.y || a.box.x - b.box.x,
    );
    for (let i = 0; i < sortedRoots.length - 1; i++) {
      const cur = sortedRoots[i];
      const next = sortedRoots[i + 1];
      const scale = cur.box.scale || 1;
      const gapY = cleanPx(next.box.y - (cur.box.y + cur.box.height), scale);
      if (gapY > 0) {
        cur.computedStyle = mergeInlineStyles(
          cur.computedStyle,
          `margin-bottom: ${gapY}px;`,
        );
      }
    }
  }

  for (const root of nodes) {
    processNode(root, true);
  }
}

export function compileWireframeBoxesToTree(
  boxes: WireframeBox[],
  donorMap?: Map<string, HtmlNode>,
): HtmlNode[] {
  if (boxes.length === 0) return [];

  const nodes: IntermediateNode[] = boxes.map((box) => ({
    box,
    children: [],
    parent: null,
    computedStyle: box.style || "",
  }));

  nodes.sort((a, b) => {
    const areaDiff = b.box.width * b.box.height - a.box.width * a.box.height;
    if (areaDiff !== 0) return areaDiff;

    const priorityDiff =
      getBoxSortPriority(b.box, donorMap) - getBoxSortPriority(a.box, donorMap);
    if (priorityDiff !== 0) return priorityDiff;

    const aHasDonor = a.box.donorKey ? 1 : 0;
    const bHasDonor = b.box.donorKey ? 1 : 0;
    return aHasDonor - bHasDonor;
  });

  const nodeById = new Map<string, IntermediateNode>();
  for (const n of nodes) {
    nodeById.set(n.box.id, n);
  }

  const wouldCreateCycle = (
    child: IntermediateNode,
    candidateParent: IntermediateNode,
  ): boolean => {
    let cursor: IntermediateNode | null = candidateParent;
    while (cursor) {
      if (cursor === child) return true;
      cursor = cursor.parent;
    }
    return false;
  };

  for (const current of nodes) {
    const pid = current.box.parentId;
    if (!pid) continue;
    const explicitParent = nodeById.get(pid);
    if (
      explicitParent &&
      canBeParentContainer(explicitParent.box, donorMap) &&
      !wouldCreateCycle(current, explicitParent)
    ) {
      current.parent = explicitParent;
      explicitParent.children.push(current);
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const current = nodes[i];
    if (current.parent !== null) continue;

    let bestParent: IntermediateNode | null = null;
    for (let j = 0; j < i; j++) {
      const candidate = nodes[j];
      if (!canBeParentContainer(candidate.box, donorMap)) continue;
      if (wouldCreateCycle(current, candidate)) continue;

      if (isContained(current.box, candidate.box)) {
        if (
          !bestParent ||
          candidate.box.width * candidate.box.height <=
            bestParent.box.width * bestParent.box.height
        ) {
          bestParent = candidate;
        }
      }
    }

    if (bestParent) {
      current.parent = bestParent;
      bestParent.children.push(current);
    }
  }

  const rootNodes = nodes.filter((n) => n.parent === null);
  rootNodes.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);

  applyManualDirectionToUls(rootNodes, donorMap);
  applySpacingToTree(rootNodes);

  function convertToHtmlNode(node: IntermediateNode): HtmlNode {
    const isManualDir = Boolean(
      node.box.listDirection && node.box.listDirection !== "auto",
    );
    const isFlexWrap = Boolean(
      node.computedStyle && /flex-wrap\s*:\s*wrap/i.test(node.computedStyle),
    );
    const isFlexRow = Boolean(
      node.computedStyle &&
      /display\s*:\s*flex/i.test(node.computedStyle) &&
      !/flex-direction\s*:\s*column/i.test(node.computedStyle),
    );

    if (!isManualDir) {
      if (isFlexWrap) {
        node.children.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
      } else if (isFlexRow) {
        node.children.sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y);
      } else {
        node.children.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
      }
    }

    const finalBoxStyle = node.computedStyle || "";
    const compiledChildren = node.children.map(convertToHtmlNode);

    const baseNode: HtmlNode = {
      tag: node.box.tag ? node.box.tag : "",
      class: "",
      style: finalBoxStyle,
      children: compiledChildren,
      _key: generateNodeKey(),
    };

    let resultNode: HtmlNode;

    if (node.box.donorKey && donorMap) {
      const donorNode = donorMap.get(node.box.donorKey);
      if (donorNode) {
        const merged = applyDonorToSlot(baseNode, donorNode);
        if (compiledChildren.length > 0) {
          merged.children = compiledChildren;
        }

        if (isImageWrapperNode(donorNode)) {
          const scale = node.box.scale || 1;
          const donorFigma = (donorNode as any)._figma;
          const figmaW =
            typeof donorFigma?.width === "number"
              ? donorFigma.width
              : parseFloat(donorNode.attributes?.["data-figma-w"] || "");
          const figmaH =
            typeof donorFigma?.height === "number"
              ? donorFigma.height
              : parseFloat(donorNode.attributes?.["data-figma-h"] || "");
          const w =
            !isNaN(figmaW) && figmaW > 0
              ? Math.round(figmaW)
              : Math.round(node.box.width / scale);
          const h =
            !isNaN(figmaH) && figmaH > 0
              ? Math.round(figmaH)
              : Math.round(node.box.height / scale);

          const cleanedBase = mergeInlineStyles(
            donorNode.style,
            finalBoxStyle,
          ).replace(/(?:^|;)\s*min-height\s*:\s*100px\s*;?/gi, ";");

          merged.style = mergeInlineStyles(
            cleanedBase,
            `width: ${w}px; height: ${h}px; position: relative; flex-shrink: 0;`,
          );
        } else {
          merged.style = mergeInlineStyles(donorNode.style, finalBoxStyle);
        }

        resultNode = promoteBoldTextTagIfNeeded(
          stripFigmaAttributes(merged),
          donorNode.style,
        );
      } else {
        resultNode = promoteBoldTextTagIfNeeded(stripFigmaAttributes(baseNode));
      }
    } else {
      resultNode = promoteBoldTextTagIfNeeded(stripFigmaAttributes(baseNode));
    }

    if (
      (resultNode.tag || "").trim().toLowerCase() === "ul" &&
      node.box.listItemPreset &&
      node.box.listItemPreset !== "none"
    ) {
      resultNode = applyListItemPresetToUl(resultNode, node.box.listItemPreset);
    }

    return resultNode;
  }

  return rootNodes.map(convertToHtmlNode);
}

// ─── Присвоение БЭМ-классов секции и извлечение стилей под классы ───────────

function replaceHexColorsWithVars(
  cssValue: string,
  colorMap?: ColorVariableMap,
): string {
  if (!colorMap || colorMap.size === 0) return cssValue;
  return cssValue.replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => {
    const mapped = colorMap.get(hex.toLowerCase());
    return mapped || hex;
  });
}

const FONT_CSS_PROPS = new Set(["font-family", "font-size", "font-weight"]);

export function applySectionClassAndExtractScss(
  nodes: HtmlNode[],
  rawSectionClass: string,
  colorMap?: ColorVariableMap,
): {
  nodes: HtmlNode[];
  classStylesMap: Map<string, string>;
} {
  const sectionClass = rawSectionClass
    .trim()
    .replace(/^\.+/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!sectionClass || nodes.length === 0) {
    return { nodes, classStylesMap: new Map() };
  }

  let preparedRoots: HtmlNode[];
  if (nodes.length === 1) {
    const root = nodes[0];
    const filteredClasses = (root.class || "")
      .trim()
      .split(/\s+/)
      .filter((c) => c && !c.startsWith("section-"));
    const nextClass = [sectionClass, ...filteredClasses].join(" ");
    preparedRoots = [
      {
        ...root,
        tag: root.tag || "section",
        class: nextClass,
      },
    ];
  } else {
    preparedRoots = [
      {
        tag: "section",
        text: "",
        class: sectionClass,
        style: "",
        children: nodes,
        _key: generateNodeKey(),
      },
    ];
  }

  const rootKey = getNodeKey(preparedRoots[0]);
  const bemNodes = applyBemClassesToSection(preparedRoots, rootKey, {
    forceSectionStructure: true,
  });

  const classStylesMap = new Map<string, string>();
  const classOccurrenceCounter = new Map<string, number>();

  function extractAndClean(node: HtmlNode): HtmlNode {
    const clsList = (node.class || "").trim().split(/\s+/).filter(Boolean);
    const hasFontClass = clsList.some((c) => c.startsWith("font-"));
    const isServiceIs = clsList.includes("is");

    const bemClass = isServiceIs
      ? "is"
      : clsList.find((c) => c.startsWith(`${sectionClass}__`)) ||
        clsList.find((c) => c === sectionClass);

    let nextClassList = clsList;
    let nextStyle = node.style || "";

    if (bemClass) {
      if (nextStyle.trim()) {
        const trimmedStyle = nextStyle.trim();

        if (trimmedStyle.includes("{")) {
          const finalBody = `  ${replaceHexColorsWithVars(trimmedStyle, colorMap)}`;
          if (!classStylesMap.has(bemClass)) {
            classStylesMap.set(bemClass, finalBody);
          }
        } else {
          const declLines: string[] = [];
          for (const rawDecl of trimmedStyle.split(";")) {
            const trimmed = rawDecl.trim();
            if (!trimmed) continue;
            const colonIdx = trimmed.indexOf(":");
            if (colonIdx === -1) continue;
            const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
            const val = trimmed.slice(colonIdx + 1).trim();
            if (!prop || !val) continue;

            if (hasFontClass && FONT_CSS_PROPS.has(prop)) {
              continue;
            }

            const finalVal = replaceHexColorsWithVars(val, colorMap);
            declLines.push(`  ${prop}: ${finalVal};`);
          }

          if (declLines.length > 0) {
            const scssBody = declLines.join("\n");
            const count = (classOccurrenceCounter.get(bemClass) || 0) + 1;
            classOccurrenceCounter.set(bemClass, count);

            if (!classStylesMap.has(bemClass)) {
              classStylesMap.set(bemClass, scssBody);
            } else if (
              classStylesMap.get(bemClass) !== scssBody &&
              !isServiceIs
            ) {
              const modClass = `${bemClass}--${count}`;
              classStylesMap.set(modClass, scssBody);
              nextClassList = [...clsList, modClass];
            }
          }
        }
      }
      nextStyle = "";
    }

    return {
      ...node,
      class: nextClassList.join(" "),
      style: nextStyle,
      children: Array.isArray(node.children)
        ? node.children.map(extractAndClean)
        : node.children,
    };
  }

  const cleanNodes = bemNodes.map(extractAndClean);
  return { nodes: cleanNodes, classStylesMap };
}
