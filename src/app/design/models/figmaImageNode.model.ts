import type { HtmlNode } from "@/types/HtmlNode";

export interface FigmaBoundsMeta {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  pageX?: number;
  pageY?: number;
  sectionId?: string;
  sectionWidth?: number;
  sectionHeight?: number;
}

export interface FigmaImageItem {
  id: string;
  name: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  pageX?: number;
  pageY?: number;
  sectionId?: string;
  section?: string;
  sectionWidth?: number;
  sectionHeight?: number;
  data: string; // Base64 Data URL (data:image/jpeg;base64,...)
  scaleMode?: string;
}

export function buildFigmaBoundsAttributes(
  meta?: FigmaBoundsMeta,
): Record<string, string> {
  if (!meta) return {};
  const attrs: Record<string, string> = {};
  if (typeof meta.x === "number" && Number.isFinite(meta.x)) {
    attrs["data-figma-x"] = String(meta.x);
  }
  if (typeof meta.y === "number" && Number.isFinite(meta.y)) {
    attrs["data-figma-y"] = String(meta.y);
  }
  if (typeof meta.width === "number" && Number.isFinite(meta.width)) {
    attrs["data-figma-w"] = String(meta.width);
  }
  if (typeof meta.height === "number" && Number.isFinite(meta.height)) {
    attrs["data-figma-h"] = String(meta.height);
  }
  if (typeof meta.pageX === "number" && Number.isFinite(meta.pageX)) {
    attrs["data-figma-px"] = String(meta.pageX);
  }
  if (typeof meta.pageY === "number" && Number.isFinite(meta.pageY)) {
    attrs["data-figma-py"] = String(meta.pageY);
  }
  if (meta.sectionId) attrs["data-figma-sec-id"] = String(meta.sectionId);
  if (
    typeof meta.sectionWidth === "number" &&
    Number.isFinite(meta.sectionWidth)
  ) {
    attrs["data-figma-sec-w"] = String(meta.sectionWidth);
  }
  if (
    typeof meta.sectionHeight === "number" &&
    Number.isFinite(meta.sectionHeight)
  ) {
    attrs["data-figma-sec-h"] = String(meta.sectionHeight);
  }
  return attrs;
}

function isValidImageEntry(img: unknown): img is FigmaImageItem {
  if (!img || typeof img !== "object") return false;
  const candidate = img as Partial<FigmaImageItem>;
  return (
    typeof candidate.data === "string" &&
    candidate.data.startsWith("data:image/")
  );
}

/**
 * 🔹 Extracts images array from Figma plugin JSON
 * Handles both [{ images: [...] }, ...] and { images: [...] } formats
 */
export function extractImagesFromJson(rawJson: string): FigmaImageItem[] {
  if (!rawJson || !rawJson.trim()) return [];

  try {
    const parsed = JSON.parse(rawJson);

    // Case 1: Array of sections [{ colors: [...] }, { images: [...] }, ...]
    if (Array.isArray(parsed)) {
      const collected: FigmaImageItem[] = [];
      for (const section of parsed) {
        if (section && Array.isArray(section.images)) {
          for (const img of section.images) {
            if (isValidImageEntry(img)) {
              collected.push(img);
            }
          }
        }
      }
      return collected;
    }

    // Case 2: Single object with images array { images: [...] }
    if (parsed && Array.isArray(parsed.images)) {
      return parsed.images.filter(isValidImageEntry);
    }

    return [];
  } catch {
    return [];
  }
}

const IMAGE_IS_INNER_STYLE =
  "overflow: hidden; position: absolute !important; width: 100%; height: 100%; top: 0; left: 0; img { height: 100% !important; width: 100% !important; object-fit: cover; object-position: top; position: absolute; top: 0; left: 0; margin: 0 0 0 0 !important; padding: 0 0 0 0 !important; }";

/**
 * 🔹 Converts processed image item into Plaza container block:
 *    div (dimensions + position: relative) -> div.is (object-fit cover) -> img
 */
export function createHtmlNodeFromImage(item: {
  name: string;
  activeBase64: string;
  width?: number;
  height?: number;
  figmaMeta?: FigmaBoundsMeta;
}): HtmlNode {
  const cleanAlt = item.name.replace(/\.[^/.]+$/, "").trim() || "image";
  const rawW = item.figmaMeta?.width ?? item.width;
  const rawH = item.figmaMeta?.height ?? item.height;
  const boxWidth = typeof rawW === "number" ? rawW : Number(rawW);
  const boxHeight = typeof rawH === "number" ? rawH : Number(rawH);

  const sizeParts: string[] = [];
  if (Number.isFinite(boxWidth) && boxWidth > 0) {
    sizeParts.push(`width: ${Math.round(boxWidth)}px`);
  } else {
    sizeParts.push("width: 100%");
  }
  if (Number.isFinite(boxHeight) && boxHeight > 0) {
    sizeParts.push(`height: ${Math.round(boxHeight)}px`);
  } else {
    sizeParts.push("min-height: 100px");
  }
  sizeParts.push("position: relative", "flex-shrink: 0");

  const stamp = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    tag: "div",
    text: "",
    class: "",
    style: `${sizeParts.join("; ")};`,
    attributes: {
      ...buildFigmaBoundsAttributes(item.figmaMeta),
    },
    children: [
      {
        tag: "div",
        text: "",
        class: "is",
        style: IMAGE_IS_INNER_STYLE,
        attributes: {},
        children: [
          {
            tag: "img",
            text: "",
            class: "",
            style: "",
            children: [],
            attributes: {
              alt: cleanAlt,
              src: item.activeBase64,
            },
            _key: `img_${stamp}`,
          },
        ],
        _key: `is_${stamp}`,
      },
    ],
    _key: `img_box_${stamp}`,
  };
}
