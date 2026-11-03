import type { HtmlNode } from "@/types/HtmlNode";

export interface FigmaImageItem {
  id: string;
  name: string;
  width: number;
  height: number;
  data: string; // Base64 Data URL (data:image/jpeg;base64,...)
  scaleMode?: string;
}

/**
 * 🔹 Extracts images array from Figma plugin JSON
 * Handles both [{ images: [...] }] and { images: [...] } formats
 */
export function extractImagesFromJson(rawJson: string): FigmaImageItem[] {
  if (!rawJson || !rawJson.trim()) return [];

  try {
    const parsed = JSON.parse(rawJson);

    // Case 1: Array of sections [{ colors: [...] }, { images: [...] }, ...]
    if (Array.isArray(parsed)) {
      for (const section of parsed) {
        if (section && Array.isArray(section.images)) {
          return section.images.filter(
            (img: any) =>
              img &&
              typeof img.data === "string" &&
              img.data.startsWith("data:image/"),
          );
        }
      }
    }

    // Case 2: Single object with images array { images: [...] }
    if (parsed && Array.isArray(parsed.images)) {
      return parsed.images.filter(
        (img: any) =>
          img &&
          typeof img.data === "string" &&
          img.data.startsWith("data:image/"),
      );
    }

    return [];
  } catch (err) {
    return [];
  }
}

/**
 * 🔹 Converts processed image item into ready Plaza HtmlNode
 * Uses natural responsive dimensions without hardcoded width/height attributes
 */
export function createHtmlNodeFromImage(item: {
  name: string;
  activeBase64: string;
}): HtmlNode {
  const cleanAlt = item.name.replace(/\.[^/.]+$/, "").trim() || "image";

  return {
    tag: "img",
    text: "",
    class: "figma-img",
    style: "max-width: 100%; height: auto; display: block;",
    children: [],
    attributes: {
      src: item.activeBase64,
      alt: cleanAlt,
    },
    _key: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };
}
