import type { HtmlNode } from "@/types/HtmlNode";

export interface FigmaSvgItem {
  id: string;
  name: string;
  content: string; // Строка вида <svg ...>...</svg>
  width: number;
  height: number;
}

export const SVG_TAG_CASING: Record<string, string> = {
  clippath: "clipPath",
  lineargradient: "linearGradient",
  radialgradient: "radialGradient",
  textpath: "textPath",
  foreignobject: "foreignObject",
  fegaussianblur: "feGaussianBlur",
  femerge: "feMerge",
  femergenode: "feMergeNode",
  fecolormatrix: "feColorMatrix",
  fecomposite: "feComposite",
  feblend: "feBlend",
  feoffset: "feOffset",
  fedropshadow: "feDropShadow",
  animatecolor: "animateColor",
  animatemotion: "animateMotion",
  animatetransform: "animateTransform",
};

export const SVG_ATTR_CASING: Record<string, string> = {
  viewbox: "viewBox",
  preserveaspectratio: "preserveAspectRatio",
  gradientunits: "gradientUnits",
  gradienttransform: "gradientTransform",
  spreadmethod: "spreadMethod",
  patternunits: "patternUnits",
  patterntransform: "patternTransform",
  clippathunits: "clipPathUnits",
  maskcontentunits: "maskContentUnits",
  maskunits: "maskUnits",
  stddeviation: "stdDeviation",
  startoffset: "startOffset",
  textlength: "textLength",
  lengthadjust: "lengthAdjust",
  pathlength: "pathLength",
  basefrequency: "baseFrequency",
  numoctaves: "numOctaves",
};

/**
 * 🔹 Extracts SVGs array from Figma plugin JSON
 */
export function extractSvgsFromJson(rawJson: string): FigmaSvgItem[] {
  if (!rawJson || !rawJson.trim()) return [];

  try {
    const parsed = JSON.parse(rawJson);

    // Case 1: Array of sections [{ colors: [...] }, { svgs: [...] }, ...]
    if (Array.isArray(parsed)) {
      for (const section of parsed) {
        if (section && Array.isArray(section.svgs)) {
          return section.svgs.filter(
            (item: any) =>
              item &&
              typeof item.content === "string" &&
              item.content.includes("<svg"),
          );
        }
      }
    }

    // Case 2: Object with svgs array { svgs: [...] }
    if (parsed && Array.isArray(parsed.svgs)) {
      return parsed.svgs.filter(
        (item: any) =>
          item &&
          typeof item.content === "string" &&
          item.content.includes("<svg"),
      );
    }

    return [];
  } catch (err) {
    return [];
  }
}

/**
 * 🔹 Recursively converts SVG DOM element to Plaza HtmlNode with casing correction
 */
export function domToSvgHtmlNode(el: Element): HtmlNode {
  const rawTag = el.tagName;
  const lowerTag = rawTag.toLowerCase();
  const tag = SVG_TAG_CASING[lowerTag] || rawTag;

  const attributes: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (attr.name === "class" || attr.name === "style") continue;
    const lowerAttrName = attr.name.toLowerCase();
    const attrName = SVG_ATTR_CASING[lowerAttrName] || attr.name;
    attributes[attrName] = attr.value;
  }

  const children: HtmlNode[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    if (child.tagName.toLowerCase() === "script") continue;
    children.push(domToSvgHtmlNode(child));
  }

  let text = "";
  if (children.length === 0 && el.textContent) {
    const trimmed = el.textContent.trim();
    if (trimmed) text = trimmed;
  }

  const rawClass = el.getAttribute("class") || "";
  const cleanClass = rawClass.replace(/\bsvg-custom\b/g, "").trim();

  return {
    tag,
    text,
    class: cleanClass,
    style: el.getAttribute("style") || "",
    attributes,
    children,
    _key: `svg_node_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  };
}

/**
 * 🔹 Encodes SVG string to Data-URI Base64
 */
export function svgStringToBase64(svgStr: string): string {
  try {
    const clean = svgStr.trim();
    const utf8Bytes = new TextEncoder().encode(clean);
    let binary = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  } catch {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
  }
}
