import type { HtmlNode } from "@/types/HtmlNode";
import { getNodeKey } from "@/app/plaza/components/CanvasArea/models/canvasModel";
import {
  LEAF_TAGS,
  isImageWrapperNode,
  type RawFigmaNodeEntry,
} from "./wireframeTypes";

export function isSvgDonorNode(node: HtmlNode): boolean {
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

export function extractCssFromSvgNode(node: HtmlNode): string {
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

export function collectFigmaNodesFromTree(
  tree: HtmlNode[],
): RawFigmaNodeEntry[] {
  const collected: RawFigmaNodeEntry[] = [];

  function walk(list: HtmlNode[]) {
    for (const node of list) {
      const key = getNodeKey(node);
      const attrs = node.attributes;
      const figma = (node as any)._figma;
      const isImgWrap = isImageWrapperNode(node);
      const isSvgShape = isSvgDonorNode(node);

      const rawX =
        figma?.x ??
        (attrs?.["data-figma-x"] !== undefined
          ? parseFloat(attrs["data-figma-x"])
          : undefined);
      const rawY =
        figma?.y ??
        (attrs?.["data-figma-y"] !== undefined
          ? parseFloat(attrs["data-figma-y"])
          : undefined);
      const rawW =
        figma?.width ??
        (attrs?.["data-figma-w"] !== undefined
          ? parseFloat(attrs["data-figma-w"])
          : undefined);
      const rawH =
        figma?.height ??
        (attrs?.["data-figma-h"] !== undefined
          ? parseFloat(attrs["data-figma-h"])
          : undefined);

      if (
        key &&
        rawX !== undefined &&
        rawY !== undefined &&
        rawW !== undefined &&
        rawH !== undefined
      ) {
        const x = Number(rawX);
        const y = Number(rawY);
        const width = Number(rawW);
        const height = Number(rawH);
        const pageX =
          figma?.pageX ??
          (attrs?.["data-figma-px"] !== undefined
            ? parseFloat(attrs["data-figma-px"])
            : x);
        const pageY =
          figma?.pageY ??
          (attrs?.["data-figma-py"] !== undefined
            ? parseFloat(attrs["data-figma-py"])
            : y);
        const sectionWidth =
          figma?.sectionWidth ??
          (attrs?.["data-figma-sec-w"] !== undefined
            ? parseFloat(attrs["data-figma-sec-w"])
            : width);

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
            sectionId: figma?.sectionId || attrs?.["data-figma-sec-id"] || "",
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
