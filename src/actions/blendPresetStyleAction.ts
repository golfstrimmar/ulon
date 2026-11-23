"use server";

import type { HtmlNode } from "@/types/HtmlNode";

export interface BlendPresetStyleParams {
  donorNode: HtmlNode | HtmlNode[];
  presetNode: HtmlNode | HtmlNode[];
}

export interface BlendPresetStyleResult {
  success: boolean;
  styledPreset?: HtmlNode[];
  error?: string;
}

interface ExtractedMedia {
  images: Array<{ mimeType: string; data: string; description?: string }>;
  svgs: string[];
}

function extractMediaFromTree(nodes: HtmlNode[]): ExtractedMedia {
  const images: Array<{ mimeType: string; data: string; description?: string }> = [];
  const svgs: string[] = [];

  function walk(list: HtmlNode[]) {
    for (const node of list) {
      const tag = (node.tag || "").toLowerCase();

      // Check SVG nodes
      if (tag === "svg") {
        try {
          svgs.push(JSON.stringify(node));
        } catch {
          // ignore
        }
      }

      // Check src attribute
      const src = node.attributes?.src || "";
      if (src.startsWith("data:image/")) {
        const match = src.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) {
          const rawMime = match[1].toLowerCase();
          const mimeType =
            rawMime === "jpg"
              ? "image/jpeg"
              : rawMime === "svg+xml"
                ? "image/svg+xml"
                : `image/${rawMime}`;

          if (mimeType === "image/svg+xml") {
            try {
              const decodedSvg = Buffer.from(match[2].trim(), "base64").toString("utf-8");
              svgs.push(decodedSvg);
            } catch {
              // ignore
            }
          } else if (["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
            // Keep at most 4 images to respect payload constraints
            if (images.length < 4) {
              images.push({
                mimeType,
                data: match[2].trim(),
                description: `Node <${node.tag}> (class: "${node.class || ""}", style: "${node.style || ""}")`,
              });
            }
          }
        } else if (src.startsWith("data:image/svg+xml")) {
          try {
            const decodedSvg = decodeURIComponent(src.split(",")[1] || "");
            svgs.push(decodedSvg);
          } catch {
            // ignore
          }
        }
      }

      // Check background-image in inline style
      if (node.style && node.style.includes("data:image/")) {
        const bgMatch = node.style.match(
          /url\(['"]?data:image\/([a-zA-Z0-9+.-]+);base64,([^'"]+)['"]?\)/i,
        );
        if (bgMatch) {
          const rawMime = bgMatch[1].toLowerCase();
          const mimeType = rawMime === "jpg" ? "image/jpeg" : `image/${rawMime}`;
          if (["image/png", "image/jpeg", "image/webp"].includes(mimeType) && images.length < 4) {
            images.push({
              mimeType,
              data: bgMatch[2].trim(),
              description: `Background-image on <${node.tag}> (class: "${node.class || ""}")`,
            });
          }
        }
      }

      if (Array.isArray(node.children)) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return { images, svgs };
}

const SYSTEM_PROMPT = `
You are an expert Frontend Architect and Design System Compiler.
You are given two JSON trees representing HTML nodes:
1. "donor": A static HTML/JSON fragment extracted from a Figma design generator. Its visual styles (colors, backgrounds, fonts, sizes, padding, borders, shadows, radii, or attached images/SVGs) accurately reflect the design layout.
2. "preset": A production-ready interactive component preset (e.g., slider, gallery, tabs, accordion, form input, checkbox, radio, button).
   Every node in the preset strictly contains: "tag", "text", "class", "style", "attributes", "children".
   The preset may also contain an interactive <script> node at the end.

YOUR GOAL:
Transplant the visual styling DNA from the "donor" into the "preset" in a single automated step.

STRICT RULES:
1. DO NOT change the DOM structure, tags, classes, or hierarchy of the "preset".
2. DO NOT modify, delete, or break the <script> node in the "preset". All JavaScript logic, selectors, and event handlers must remain completely intact.
3. EXTRACT visual design tokens from the "donor":
   - Dominant background color / surface colors / gradients.
   - Accent color, primary color, hover colors.
   - Text colors, heading colors, font families, font weights, line heights.
   - Border radius, border colors, border widths.
   - Box shadows, element paddings, gaps.

4. CRITICAL RULE FOR DUMB FIGMA CONTROLS (CHECKBOXES, RADIOS, TOGGLES, BUTTONS, ICONS):
   Designers frequently export UI controls as dumb raster images (<img>), vector shapes (<svg>), or flat empty <div> rectangles.
   a. NEVER convert or replace the preset's accessible HTML structure (such as <input type="checkbox">, <input type="radio">, <label>, <button>) into an <img> or dumb <div>!
   b. The preset MUST remain a 100% interactive, semantic HTML component.
   c. EXTRACT VISUAL PROPERTIES from the dumb image / SVG / div:
      - Box size: control width and height (e.g. 16px, 18px, 20px, 24px).
      - Border: border-color, border-width, border-style.
      - Corner radius: border-radius (e.g. 4px, 6px for checkbox; 50% for radio; 9999px for pill toggle).
      - Colors: unchecked border/bg vs checked/active background color.
      - Checkmark / icon: color of the checkmark tick (e.g. #ffffff) or dot.
      - Label text: font-family, font-size, font-weight, line-height, text color, spacing.
   d. MAP DIRECTLY TO PRESET'S CSS VARIABLES & INLINE STYLES:
      - Checkbox preset (e.g. input-check): update --check-border, --check-active, --check-text, and adjust the &::before / &::after box dimensions and border-radius in the label's style string to match the designer's box.
      - Radio preset (e.g. f-radio): update --radio-border, --radio-accent, --radio-text, &::before / &::after dimensions.
      - Text input (e.g. input-field): update --input-border, --input-bg, --input-text, --input-radius.
      - Button (e.g. btn-anker): update --btn-bg, --btn-border, --btn-radius, --btn-color, --btn-font.
   e. If the donor contains attached visual images (via vision), inspect their exact colors and dimensions!

5. INJECT these styles into the "preset":
   - First, update the root scoped CSS variables declared in the preset root's "style" string (e.g., --gallery-bg, --gallery-accent, --check-border, --btn-bg, --card-radius, etc.) so they match the donor's palette and shapes.
   - Second, update the inline "style" strings of preset elements (titles, buttons, cards, captions, labels) to match fonts, weights, padding, and borders from the corresponding donor elements.
   - Keep nested pseudo-classes like &:hover, &:active, &.active, &::before, &::after in the preset's style strings.

6. Every single returned node in the preset MUST maintain all 6 keys: "tag", "text", "class", "style", "attributes", "children".
7. Return ONLY a valid JSON object matching the requested schema: { "styledPreset": [...] } or a direct JSON array of nodes.
`;

export async function blendPresetStyleAction({
  donorNode,
  presetNode,
}: BlendPresetStyleParams): Promise<BlendPresetStyleResult> {
  const apiKey = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, "").trim();
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not configured in environment variables",
    };
  }

  const donorClean = Array.isArray(donorNode) ? donorNode : [donorNode];
  const presetClean = Array.isArray(presetNode) ? presetNode : [presetNode];

  const candidateModels = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-3.5-flash-lite",
  ];

  const { images, svgs } = extractMediaFromTree(donorClean);

  const parts: any[] = [];

  // Add any base64 images found in the donor for multimodal visual inspection
  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    });
  }

  // Build text prompt, enriched with any extracted SVG vectors
  let enrichedPrompt = `
DONOR FROM FIGMA (Visual styling source):
${JSON.stringify(donorClean, null, 2)}
`;

  if (svgs.length > 0) {
    enrichedPrompt += `\nEMBEDDED SVG VECTORS EXTRACTED FROM DONOR (inspect fills, strokes, paths for icons/ticks/shapes):\n${svgs.join("\n---\n")}\n`;
  }

  enrichedPrompt += `
PRESET TO STYLE (Target interactive component):
${JSON.stringify(presetClean, null, 2)}

Please extract the visual styling (colors, fonts, borders, shadows, radii) from the donor and inject it into the preset's CSS variables and node styles.
Return the updated preset JSON strictly conforming to the 6-key schema and keeping all scripts and classes intact.
`;

  parts.push({ text: enrichedPrompt });

  const body = {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  let lastError = "";

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[blendPresetStyleAction] Model ${model} returned ${response.status}:`, errText);
        lastError = `Model ${model} (${response.status}): ${errText.slice(0, 150)}`;
        continue; // try next model
      }

      const json = await response.json();
      const rawText =
        json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      // Strip markdown code fences if present
      const cleanedText = rawText
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```\s*$/, "")
        .trim();

      const parsed = JSON.parse(cleanedText);
      const rawArray = Array.isArray(parsed)
        ? parsed
        : parsed?.styledPreset && Array.isArray(parsed.styledPreset)
          ? parsed.styledPreset
          : null;

      if (!rawArray || rawArray.length === 0) {
        lastError = "AI did not return a valid preset array";
        continue;
      }

      // Ensure all nodes recursively have the strict 6 keys
      function sanitize(node: any): HtmlNode {
        return {
          tag: String(node.tag || "div"),
          text: String(node.text ?? ""),
          class: String(node.class ?? ""),
          style: String(node.style ?? ""),
          attributes:
            typeof node.attributes === "object" && node.attributes !== null
              ? node.attributes
              : {},
          children: Array.isArray(node.children)
            ? node.children.map(sanitize)
            : [],
        };
      }

      const sanitizedPreset = rawArray.map(sanitize);

      return {
        success: true,
        styledPreset: sanitizedPreset,
      };
    } catch (err: any) {
      console.warn(`[blendPresetStyleAction] Attempt with ${model} failed:`, err?.message);
      lastError = err?.message || String(err);
    }
  }

  return {
    success: false,
    error: lastError || "Failed to blend preset styles with AI",
  };
}
