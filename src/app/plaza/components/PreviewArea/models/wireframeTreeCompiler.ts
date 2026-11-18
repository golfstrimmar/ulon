import type { HtmlNode } from "@/types/HtmlNode";
import {
  applyBemClassesToSection,
  applyDonorToSlot,
  getNodeKey,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import type { ColorVariableMap } from "@/app/design/models/figmaTextNode.model";

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
}

export interface OverlayMetrics {
  hasActiveOverlay: boolean;
  imgWidth: number;
  align: string;
  offsetX: number;
  offsetY: number;
}

interface IntermediateNode {
  box: WireframeBox;
  children: IntermediateNode[];
  parent: IntermediateNode | null;
  computedStyle?: string;
}

const LEAF_TAGS = new Set([
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

function canBeParentContainer(
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

function getBoxSortPriority(
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

function mergeInlineStyles(baseStyle?: string, extraStyle?: string): string {
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

function formatCssBoxSpacing(
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

function stripFigmaAttributes(node: HtmlNode): HtmlNode {
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

  return {
    ...node,
    attributes: nextAttrs,
    children: Array.isArray(node.children)
      ? node.children.map(stripFigmaAttributes)
      : node.children,
  };
}

function isContained(
  inner: WireframeBox,
  outer: WireframeBox,
  tolerance = 3,
): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

/**
 * Рассчитывает padding для контейнеров и margin-отступы между дочерними нодами
 */
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
    const isFlexRow = Boolean(
      node.computedStyle &&
      /display\s*:\s*flex/i.test(node.computedStyle) &&
      !/flex-direction\s*:\s*column/i.test(node.computedStyle),
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
      if (isFlexRow) {
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

          if (!alignIsCenter) {
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

  for (let i = 0; i < nodes.length; i++) {
    const current = nodes[i];
    let bestParent: IntermediateNode | null = null;

    for (let j = 0; j < i; j++) {
      const candidate = nodes[j];
      if (!canBeParentContainer(candidate.box, donorMap)) continue;

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

  applySpacingToTree(rootNodes);

  function convertToHtmlNode(node: IntermediateNode): HtmlNode {
    const isFlexRow = Boolean(
      node.computedStyle &&
      /display\s*:\s*flex/i.test(node.computedStyle) &&
      !/flex-direction\s*:\s*column/i.test(node.computedStyle),
    );
    if (isFlexRow) {
      node.children.sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y);
    } else {
      node.children.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
    }

    const finalBoxStyle = node.computedStyle || "";
    const compiledChildren = node.children.map(convertToHtmlNode);

    const baseNode: HtmlNode = {
      tag: node.box.tag ? node.box.tag : "",
      class: "",
      style: finalBoxStyle,
      children: compiledChildren,
      _key: `box_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    if (node.box.donorKey && donorMap) {
      const donorNode = donorMap.get(node.box.donorKey);
      if (donorNode) {
        const merged = applyDonorToSlot(baseNode, donorNode);
        if (compiledChildren.length > 0) {
          merged.children = compiledChildren;
        }

        if (isImageWrapperNode(donorNode)) {
          const scale = node.box.scale || 1;
          const figmaW = parseFloat(
            donorNode.attributes?.["data-figma-w"] || "",
          );
          const figmaH = parseFloat(
            donorNode.attributes?.["data-figma-h"] || "",
          );
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

        return stripFigmaAttributes(merged);
      }
    }

    return stripFigmaAttributes(baseNode);
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

const FONT_CSS_PROPS = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "color",
]);

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
        _key: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      },
    ];
  }

  const rootKey = getNodeKey(preparedRoots[0]);
  const bemNodes = applyBemClassesToSection(preparedRoots, rootKey);

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
          // Вложенный SCSS (например у .is: "... img { ... }") — сохраняем целиком без порчи скобок
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

// ─── Сбор Figma-нод из дерева и извлечение стилей SVG-подложек ──────────────

interface RawFigmaNodeEntry {
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

function isSvgDonorNode(node: HtmlNode): boolean {
  const tag = (node.tag || "").trim().toLowerCase();
  const cls = (node.class || "").toLowerCase();
  const src = node.attributes?.src || "";
  if (tag === "svg") return true;
  if (
    tag === "img" &&
    (cls.includes("svg-img") || src.startsWith("data:image/svg+xml"))
  ) {
    return true;
  }
  if (tag === "i") {
    if (cls.includes("svg-wrapper")) return true;
    if (
      Array.isArray(node.children) &&
      node.children.some((c) => (c.tag || "").toLowerCase() === "svg")
    ) {
      return true;
    }
  }
  return false;
}

function extractCssFromSvgNode(node: HtmlNode): string {
  const styles: string[] = [];
  let bg = "";
  let border = "";
  let borderRadius = "";

  const isPaintColor = (val?: string) =>
    Boolean(val && val !== "none" && !val.trim().startsWith("url("));

  function inspectSvgHtmlNode(n: HtmlNode, insideMask = false) {
    const t = (n.tag || "").toLowerCase();
    if (t === "mask" || t === "defs" || t === "clippath") {
      insideMask = true;
    }
    if (!insideMask && (t === "path" || t === "rect")) {
      const attrs = n.attributes || {};
      const fill = attrs.fill;
      const stroke = attrs.stroke;
      const strokeWidthRaw = attrs["stroke-width"] || attrs.strokeWidth;

      if (!bg && isPaintColor(fill)) {
        bg = fill === "white" ? "#ffffff" : fill!;
      }
      if (!border && isPaintColor(stroke)) {
        const sw = parseFloat(strokeWidthRaw || "1");
        const hasMask = Boolean(attrs.mask);
        const finalWidth = Math.max(
          1,
          Math.round(hasMask && sw >= 2 ? sw / 2 : sw),
        );
        border = `${finalWidth}px solid ${stroke}`;
      }
      if (!borderRadius) {
        if (attrs.rx) {
          const r = Math.round(parseFloat(attrs.rx));
          if (r > 0) borderRadius = `${r}px`;
        } else if (attrs.d) {
          const m = /^M\s*0\s+(\d+(?:\.\d+)?)\s*C\s*0\s+/i.exec(attrs.d.trim());
          if (m) {
            const r = Math.round(parseFloat(m[1]));
            if (r > 0 && r <= 64) borderRadius = `${r}px`;
          }
        }
      }
    }
    if (Array.isArray(n.children)) {
      for (const ch of n.children) inspectSvgHtmlNode(ch, insideMask);
    }
  }

  const tag = (node.tag || "").toLowerCase();
  if (tag === "i" && Array.isArray(node.children)) {
    for (const ch of node.children) inspectSvgHtmlNode(ch, false);
  } else if (tag === "svg") {
    inspectSvgHtmlNode(node, false);
  } else if (tag === "img" && typeof DOMParser !== "undefined") {
    const src = node.attributes?.src || "";
    try {
      let svgText = "";
      if (src.startsWith("data:image/svg+xml;base64,")) {
        const b64 = src.slice("data:image/svg+xml;base64,".length);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        svgText = new TextDecoder("utf-8").decode(bytes);
      } else if (src.startsWith("data:image/svg+xml;utf8,")) {
        svgText = decodeURIComponent(
          src.slice("data:image/svg+xml;utf8,".length),
        );
      }

      if (svgText) {
        const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
        const shapes = doc.querySelectorAll("path, rect");
        shapes.forEach((el) => {
          if (el.closest("mask, defs, clipPath")) return;
          const fill = el.getAttribute("fill") || undefined;
          const stroke = el.getAttribute("stroke") || undefined;
          const swRaw = el.getAttribute("stroke-width");
          if (!bg && isPaintColor(fill)) {
            bg = fill === "white" ? "#ffffff" : fill!;
          }
          if (!border && isPaintColor(stroke)) {
            const sw = parseFloat(swRaw || "1");
            const hasMask = Boolean(el.getAttribute("mask"));
            const finalWidth = Math.max(
              1,
              Math.round(hasMask && sw >= 2 ? sw / 2 : sw),
            );
            border = `${finalWidth}px solid ${stroke}`;
          }
          if (!borderRadius) {
            const rx = el.getAttribute("rx");
            const d = el.getAttribute("d");
            if (rx) {
              const r = Math.round(parseFloat(rx));
              if (r > 0) borderRadius = `${r}px`;
            } else if (d) {
              const m = /^M\s*0\s+(\d+(?:\.\d+)?)\s*C\s*0\s+/i.exec(d.trim());
              if (m) {
                const r = Math.round(parseFloat(m[1]));
                if (r > 0 && r <= 64) borderRadius = `${r}px`;
              }
            }
          }
        });
      }
    } catch {
      // ignore SVG parse fallback errors
    }
  }

  if (bg && bg.toLowerCase() !== "#ffffff" && bg.toLowerCase() !== "#fff") {
    styles.push(`background-color: ${bg}`);
  } else if (bg && border) {
    styles.push(`background-color: ${bg}`);
  }
  if (border) styles.push(`border: ${border}`);
  if (borderRadius) styles.push(`border-radius: ${borderRadius}`);

  return styles.length > 0 ? `${styles.join("; ")};` : "";
}

function collectFigmaNodesFromTree(tree: HtmlNode[]): RawFigmaNodeEntry[] {
  const collected: RawFigmaNodeEntry[] = [];

  function walk(list: HtmlNode[]) {
    for (const node of list) {
      const key = getNodeKey(node);
      const attrs = node.attributes;
      const isImgWrap = isImageWrapperNode(node);
      const isSvgShape = isSvgDonorNode(node);

      if (
        key &&
        attrs &&
        attrs["data-figma-x"] !== undefined &&
        attrs["data-figma-y"] !== undefined &&
        attrs["data-figma-w"] !== undefined &&
        attrs["data-figma-h"] !== undefined
      ) {
        const x = parseFloat(attrs["data-figma-x"]);
        const y = parseFloat(attrs["data-figma-y"]);
        const width = parseFloat(attrs["data-figma-w"]);
        const height = parseFloat(attrs["data-figma-h"]);
        const pageX =
          attrs["data-figma-px"] !== undefined
            ? parseFloat(attrs["data-figma-px"])
            : x;
        const pageY =
          attrs["data-figma-py"] !== undefined
            ? parseFloat(attrs["data-figma-py"])
            : y;
        const sectionWidth =
          attrs["data-figma-sec-w"] !== undefined
            ? parseFloat(attrs["data-figma-sec-w"])
            : width;

        const tag = (node.tag || "").trim().toLowerCase();
        const hasChildren =
          Array.isArray(node.children) && node.children.length > 0;
        const isImageBlock = isImgWrap || tag === "img";
        const isContainerNode =
          !isSvgShape && !isImgWrap && !LEAF_TAGS.has(tag) && hasChildren;

        if (!isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height)) {
          collected.push({
            key,
            tag,
            node,
            isSvgShape,
            isImageBlock,
            isContainerNode,
            x,
            y,
            pageX: isNaN(pageX) ? x : pageX,
            pageY: isNaN(pageY) ? y : pageY,
            width: Math.max(1, width),
            height: Math.max(1, height),
            sectionId: attrs["data-figma-sec-id"] || "",
            sectionWidth: isNaN(sectionWidth) ? width : sectionWidth,
          });
        }
      }

      if (isSvgShape || (node.tag || "").toLowerCase() === "svg" || isImgWrap) {
        continue;
      }

      if (Array.isArray(node.children)) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return collected;
}

export function countFigmaNodesInTree(tree: HtmlNode[]): number {
  return collectFigmaNodesFromTree(tree).length;
}

// ─── Адаптивный 2D-алгоритм авто-порезки с определением списков (ul -> li) ─

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutNode {
  entry: RawFigmaNodeEntry;
  rect: LayoutRect;
  box: WireframeBox;
  children: LayoutNode[];
  isExplicitContainer: boolean;
}

function computeBoundingRect(items: { rect: LayoutRect }[]): LayoutRect {
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

function splitIntoBands(items: LayoutNode[], axis: "y" | "x"): LayoutNode[][] {
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

// ─── Определение однотипности блоков (для превращения в ul -> li) ────────────

interface BlockProfile {
  isComposite: boolean;
  leafCount: number;
  imgCount: number;
  svgCount: number;
  textCount: number;
  width: number;
  height: number;
  fontClass: string;
  tag: string;
}

function getGroupProfile(nodes: LayoutNode[]): BlockProfile {
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
  };
}

function areProfilesSimilar(a: BlockProfile, b: BlockProfile): boolean {
  if (a.isComposite !== b.isComposite) return false;

  if (!a.isComposite) {
    if (a.tag !== b.tag) return false;
    if (a.tag === "p" || a.tag.startsWith("h") || a.tag === "span") {
      if (a.fontClass && b.fontClass) {
        return a.fontClass === b.fontClass;
      }
      return (
        Math.max(a.height, b.height) /
          Math.max(1, Math.min(a.height, b.height)) <=
        1.3
      );
    }
    return (
      Math.max(a.width, b.width) / Math.max(1, Math.min(a.width, b.width)) <=
        1.5 &&
      Math.max(a.height, b.height) /
        Math.max(1, Math.min(a.height, b.height)) <=
        1.5
    );
  }

  if (a.imgCount > 0 !== b.imgCount > 0) return false;
  if (Math.abs(a.imgCount - b.imgCount) > 0) return false;
  if (Math.abs(a.svgCount - b.svgCount) > 1) return false;

  if (Math.abs(a.textCount - b.textCount) > 1) return false;
  if (a.textCount > 0 && b.textCount === 0) return false;
  if (b.textCount > 0 && a.textCount === 0) return false;

  const wRatio =
    Math.max(a.width, b.width) / Math.max(1, Math.min(a.width, b.width));
  const hRatio =
    Math.max(a.height, b.height) / Math.max(1, Math.min(a.height, b.height));
  if (wRatio > 1.45 || hRatio > 1.65) return false;

  return true;
}

function groupIntoUniformRuns(groups: LayoutNode[][]): {
  isList: boolean;
  items: LayoutNode[][];
}[] {
  if (groups.length < 2) {
    return groups.map((g) => ({ isList: false, items: [g] }));
  }

  const profiles = groups.map((g) => getGroupProfile(g));
  const runs: { isList: boolean; items: LayoutNode[][] }[] = [];

  let i = 0;
  while (i < groups.length) {
    let j = i + 1;
    while (j < groups.length && areProfilesSimilar(profiles[i], profiles[j])) {
      j++;
    }

    const runLen = j - i;
    const isCompositeRun = profiles[i].isComposite;
    const minRequired = isCompositeRun ? 2 : 3;

    if (runLen >= minRequired) {
      runs.push({ isList: true, items: groups.slice(i, j) });
    } else {
      for (let k = i; k < j; k++) {
        runs.push({ isList: false, items: [groups[k]] });
      }
    }

    i = j;
  }

  return runs;
}

function hasUniformBlocks(groups: LayoutNode[][]): boolean {
  if (groups.length < 2) return false;
  const runs = groupIntoUniformRuns(groups);
  return runs.some((r) => r.isList);
}

function computeFlexStyle(
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

function isSameBounds(a: LayoutRect, b: LayoutRect, tolerance = 4): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance * 2 &&
    Math.abs(a.height - b.height) <= tolerance * 2
  );
}

export function buildWireframeBoxesFromTree(
  tree: HtmlNode[],
  options: {
    containerWidth: number;
    overlayMetrics?: OverlayMetrics;
    scaleMode?: "auto" | "1x" | "2x";
    existingDonorKeys?: Set<string>;
  },
): WireframeBox[] {
  const entries = collectFigmaNodesFromTree(tree).filter(
    (e) => !options.existingDonorKeys?.has(e.key),
  );
  if (entries.length === 0) return [];

  const uniqueSections = new Set(
    entries.map((e) => e.sectionId).filter(Boolean),
  );
  const usePageCoords = uniqueSections.size > 1;

  let refWidth = 0;
  for (const e of entries) {
    const x = usePageCoords ? e.pageX : e.x;
    const right = x + e.width;
    if (right > refWidth) refWidth = right;
    if (e.sectionWidth > refWidth) {
      refWidth = e.sectionWidth;
    }
  }

  let scale = 1;
  const imgW = options.overlayMetrics?.imgWidth || 0;
  if (options.scaleMode === "2x") {
    scale = 2;
  } else if (options.scaleMode === "1x") {
    scale = 1;
  } else if (
    options.overlayMetrics?.hasActiveOverlay &&
    imgW > 0 &&
    refWidth > 0
  ) {
    const ratio = imgW / refWidth;
    if (Math.abs(ratio - 2) < 0.08) {
      scale = 2;
    } else if (ratio < 0.98) {
      scale = ratio;
    } else {
      scale = 1;
    }
  }

  let originX = 0;
  let originY = 0;

  if (options.overlayMetrics?.hasActiveOverlay) {
    originY = options.overlayMetrics.offsetY || 0;
    if (
      options.overlayMetrics.align === "center" &&
      options.containerWidth > 0
    ) {
      const targetWidth = imgW > 0 ? imgW : refWidth * scale;
      originX =
        (options.containerWidth - targetWidth) / 2 +
        (options.overlayMetrics.offsetX || 0);
    } else {
      originX = options.overlayMetrics.offsetX || 0;
    }
  }

  const stamp = Date.now();
  let seq = 0;
  const nextId = (prefix: string) =>
    `${prefix}_${stamp}_${seq++}_${Math.random().toString(36).substring(2, 6)}`;

  const toScreenRect = (e: RawFigmaNodeEntry): LayoutRect => {
    const rawX = usePageCoords ? e.pageX : e.x;
    const rawY = usePageCoords ? e.pageY : e.y;
    return {
      x: Math.round(originX + rawX * scale),
      y: Math.round(originY + rawY * scale),
      width: Math.max(2, Math.round(e.width * scale)),
      height: Math.max(2, Math.round(e.height * scale)),
    };
  };

  // 1. Строим начальные LayoutNode
  let initialItems: LayoutNode[] = entries.map((entry) => {
    const rect = toScreenRect(entry);
    return {
      entry,
      rect,
      children: [],
      isExplicitContainer: entry.isContainerNode,
      box: {
        id: nextId("figma_box"),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scale,
        tag: entry.isContainerNode ? entry.tag || "div" : "",
        donorKey: entry.key,
        sortPriority: entry.isContainerNode ? 3 : 0,
      },
    };
  });

  // 2. Превращаем фоновые SVG-прямоугольники в div-контейнеры (или сливаем дубль с секцией)
  const absorbedKeys = new Set<string>();
  const tol = Math.max(4, Math.round(4 * scale));

  for (const item of initialItems) {
    if (!item.entry.isSvgShape) continue;

    const matchingSection = initialItems.find(
      (other) =>
        other !== item &&
        other.entry.isContainerNode &&
        isSameBounds(item.rect, other.rect, tol),
    );

    const extractedCss = extractCssFromSvgNode(item.entry.node);

    if (matchingSection) {
      if (extractedCss) {
        matchingSection.box.style = mergeInlineStyles(
          matchingSection.box.style,
          extractedCss,
        );
      }
      matchingSection.box.consumedDonorKeys = [
        ...(matchingSection.box.consumedDonorKeys || []),
        item.entry.key,
      ];
      absorbedKeys.add(item.entry.key);
      continue;
    }

    const containedCount = initialItems.filter(
      (other) =>
        other !== item &&
        !other.entry.isContainerNode &&
        !absorbedKeys.has(other.entry.key) &&
        isContained({ ...other.rect, id: "" }, { ...item.rect, id: "" }, tol) &&
        other.rect.width * other.rect.height <
          item.rect.width * item.rect.height * 0.9,
    ).length;

    if (containedCount >= 1) {
      item.isExplicitContainer = true;
      item.box = {
        id: item.box.id,
        x: item.rect.x,
        y: item.rect.y,
        width: item.rect.width,
        height: item.rect.height,
        scale,
        tag: "div",
        style: extractedCss || undefined,
        consumedDonorKeys: [item.entry.key],
        sortPriority: 3,
      };
    }
  }

  if (absorbedKeys.size > 0) {
    initialItems = initialItems.filter((it) => !absorbedKeys.has(it.entry.key));
  }

  // 3. Предварительное дерево вложенности существующих контейнеров (строго без циклов: j < i)
  initialItems.sort((a, b) => {
    const areaDiff =
      b.rect.width * b.rect.height - a.rect.width * a.rect.height;
    if (areaDiff !== 0) return areaDiff;
    return (
      (b.entry.isContainerNode ? 1 : 0) - (a.entry.isContainerNode ? 1 : 0)
    );
  });

  const rootItems: LayoutNode[] = [];
  for (let i = 0; i < initialItems.length; i++) {
    const current = initialItems[i];
    let bestParent: LayoutNode | null = null;

    for (let j = 0; j < i; j++) {
      const candidate = initialItems[j];
      if (!candidate.isExplicitContainer) continue;

      if (
        isContained(
          { ...current.rect, id: "" },
          { ...candidate.rect, id: "" },
          tol,
        )
      ) {
        if (
          !bestParent ||
          candidate.rect.width * candidate.rect.height <=
            bestParent.rect.width * bestParent.rect.height
        ) {
          bestParent = candidate;
        }
      }
    }

    if (bestParent) {
      bestParent.children.push(current);
    } else {
      rootItems.push(current);
    }
  }

  const rootContainerIds = new Set(rootItems.map((r) => r.box.id));

  // 4. Адаптивная 2D-нарезка + превращение однотипных серий в ul -> li
  const generatedBoxes: WireframeBox[] = [];

  function materializeListItem(
    group: LayoutNode[],
    allowFlexGrow: boolean,
  ): { rect: LayoutRect } {
    if (group.length === 1) {
      const only = group[0];
      if (only.isExplicitContainer) {
        only.box.tag = "li";
        only.box.sortPriority = 1;
        if (allowFlexGrow) {
          only.box.style = mergeInlineStyles(only.box.style, "flex: 1;");
        }
        if (only.children.length > 0) {
          layoutSubtree(only.children, only.box);
        }
        return { rect: only.rect };
      }

      const liBox: WireframeBox = {
        id: nextId("li_box"),
        x: only.rect.x,
        y: only.rect.y,
        width: only.rect.width,
        height: only.rect.height,
        scale,
        tag: "li",
        style: allowFlexGrow ? "flex: 1;" : undefined,
        sortPriority: 1,
      };
      generatedBoxes.push(liBox);
      return { rect: only.rect };
    }

    const rect = computeBoundingRect(group);
    const liBox: WireframeBox = {
      id: nextId("li_box"),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale,
      tag: "li",
      style: allowFlexGrow ? "flex: 1;" : undefined,
      sortPriority: 1,
    };
    generatedBoxes.push(liBox);
    layoutSubtree(group, liBox);
    return { rect };
  }

  function materializeRegularColumn(group: LayoutNode[]): { rect: LayoutRect } {
    if (group.length === 1) {
      if (group[0].children.length > 0) {
        layoutSubtree(group[0].children, group[0].box);
      }
      return { rect: group[0].rect };
    }

    const colRect = computeBoundingRect(group);
    const colBox: WireframeBox = {
      id: nextId("col_box"),
      x: colRect.x,
      y: colRect.y,
      width: colRect.width,
      height: colRect.height,
      scale,
      tag: "div",
      sortPriority: 2,
    };
    generatedBoxes.push(colBox);
    layoutSubtree(group, colBox);
    return { rect: colRect };
  }

  function emitGroupsInDirection(
    groups: LayoutNode[][],
    direction: "row" | "column",
    parentBox: WireframeBox | null,
  ) {
    const runs = groupIntoUniformRuns(groups);
    const canConvertParentToUl =
      parentBox !== null &&
      !rootContainerIds.has(parentBox.id) &&
      parentBox.tag !== "section";

    const isWholeParentASingleList =
      runs.length === 1 && runs[0].isList && canConvertParentToUl;

    if (isWholeParentASingleList) {
      const listItems = runs[0].items;
      const widths = listItems.map((g) => computeBoundingRect(g).width);
      const equalWidths =
        direction === "row" &&
        Math.max(...widths) / Math.max(1, Math.min(...widths)) <= 1.25 &&
        getGroupProfile(listItems[0]).isComposite;

      const rects = listItems.map((g) => materializeListItem(g, equalWidths));
      parentBox!.tag = "ul";
      parentBox!.style = computeFlexStyle(
        rects,
        direction,
        scale,
        parentBox!.style,
      );
      return;
    }

    const topLevelItemsForParent: { rect: LayoutRect }[] = [];

    for (const run of runs) {
      if (run.isList) {
        const listItems = run.items;
        const widths = listItems.map((g) => computeBoundingRect(g).width);
        const equalWidths =
          direction === "row" &&
          Math.max(...widths) / Math.max(1, Math.min(...widths)) <= 1.25 &&
          getGroupProfile(listItems[0]).isComposite;

        const rects = listItems.map((g) => materializeListItem(g, equalWidths));
        const ulRect = computeBoundingRect(rects);
        generatedBoxes.push({
          id: nextId("ul_box"),
          x: ulRect.x,
          y: ulRect.y,
          width: ulRect.width,
          height: ulRect.height,
          scale,
          tag: "ul",
          style: computeFlexStyle(rects, direction, scale),
          sortPriority: 2,
        });
        topLevelItemsForParent.push({ rect: ulRect });
      } else {
        const group = run.items[0];
        if (direction === "row") {
          topLevelItemsForParent.push(materializeRegularColumn(group));
        } else {
          if (group.length === 1) {
            if (group[0].children.length > 0) {
              layoutSubtree(group[0].children, group[0].box);
            }
            topLevelItemsForParent.push({ rect: group[0].rect });
          } else {
            const bandCols = splitIntoBands(group, "x");
            if (bandCols.length >= 2) {
              emitGroupsInDirection(bandCols, "row", null);
            } else {
              layoutSubtree(group, null);
            }
            topLevelItemsForParent.push({ rect: computeBoundingRect(group) });
          }
        }
      }
    }

    if (direction === "row" && topLevelItemsForParent.length >= 2) {
      if (parentBox) {
        parentBox.style = computeFlexStyle(
          topLevelItemsForParent,
          "row",
          scale,
          parentBox.style,
        );
      } else {
        const rowRect = computeBoundingRect(topLevelItemsForParent);
        generatedBoxes.push({
          id: nextId("row_box"),
          x: rowRect.x,
          y: rowRect.y,
          width: rowRect.width,
          height: rowRect.height,
          scale,
          tag: "div",
          style: computeFlexStyle(topLevelItemsForParent, "row", scale),
          sortPriority: 2,
        });
      }
    }
  }

  function layoutSubtree(items: LayoutNode[], parentBox: WireframeBox | null) {
    if (items.length === 0) return;

    if (items.length === 1) {
      if (items[0].children.length > 0) {
        layoutSubtree(items[0].children, items[0].box);
      }
      return;
    }

    const yBands = splitIntoBands(items, "y");
    const xCols = splitIntoBands(items, "x");

    if (yBands.length === 1) {
      if (xCols.length >= 2) {
        emitGroupsInDirection(xCols, "row", parentBox);
      } else {
        for (const it of items) {
          if (it.children.length > 0) layoutSubtree(it.children, it.box);
        }
      }
      return;
    }

    if (xCols.length === 1) {
      emitGroupsInDirection(yBands, "column", parentBox);
      return;
    }

    const yHasUniform = hasUniformBlocks(yBands);
    const xHasUniform = hasUniformBlocks(xCols);

    if (yHasUniform && !xHasUniform) {
      emitGroupsInDirection(yBands, "column", parentBox);
      return;
    }

    const firstBandCols = splitIntoBands(yBands[0], "x").length;
    const restItems = yBands.slice(1).flat();
    const restCols = splitIntoBands(restItems, "x").length;
    const firstBandRect = computeBoundingRect(yBands[0]);
    const restRect = computeBoundingRect(restItems);
    const gapAfterFirst = restRect.y - (firstBandRect.y + firstBandRect.height);

    if (
      restCols >= 2 &&
      firstBandCols < restCols &&
      gapAfterFirst >= 8 * scale
    ) {
      layoutSubtree(yBands[0], null);
      layoutSubtree(restItems, null);
      return;
    }

    const lastBand = yBands[yBands.length - 1];
    const aboveItems = yBands.slice(0, -1).flat();
    const lastBandCols = splitIntoBands(lastBand, "x").length;
    const aboveCols = splitIntoBands(aboveItems, "x").length;
    const aboveRect = computeBoundingRect(aboveItems);
    const lastBandRect = computeBoundingRect(lastBand);
    const gapBeforeLast = lastBandRect.y - (aboveRect.y + aboveRect.height);

    if (
      aboveCols >= 2 &&
      lastBandCols < aboveCols &&
      gapBeforeLast >= 8 * scale
    ) {
      layoutSubtree(aboveItems, null);
      layoutSubtree(lastBand, null);
      return;
    }

    if (yBands.length >= 3) {
      const bandRects = yBands.map((b) => computeBoundingRect(b));
      const yGaps: number[] = [];
      for (let i = 0; i < bandRects.length - 1; i++) {
        yGaps.push(bandRects[i + 1].y - (bandRects[i].y + bandRects[i].height));
      }
      const positiveGaps = yGaps.filter((g) => g > 0);
      if (positiveGaps.length >= 2) {
        const minGapY = Math.min(...positiveGaps);
        const maxGapY = Math.max(...positiveGaps);

        if (maxGapY >= Math.max(20 * scale, minGapY * 1.8)) {
          const splitThreshold = maxGapY * 0.65;
          const macroGroups: LayoutNode[][] = [];
          let currentGroup: LayoutNode[] = [...yBands[0]];

          for (let i = 0; i < yGaps.length; i++) {
            if (yGaps[i] >= splitThreshold) {
              macroGroups.push(currentGroup);
              currentGroup = [...yBands[i + 1]];
            } else {
              currentGroup.push(...yBands[i + 1]);
            }
          }
          macroGroups.push(currentGroup);

          if (macroGroups.length >= 2 && macroGroups.length < yBands.length) {
            emitGroupsInDirection(macroGroups, "column", parentBox);
            return;
          }
        }
      }
    }

    const multiElementColsCount = xCols.filter((c) => c.length >= 2).length;
    if (xHasUniform || multiElementColsCount >= 2) {
      emitGroupsInDirection(xCols, "row", parentBox);
      return;
    }

    emitGroupsInDirection(yBands, "column", parentBox);
  }

  for (const item of initialItems) {
    generatedBoxes.push(item.box);
  }

  layoutSubtree(rootItems, null);

  return generatedBoxes;
}
