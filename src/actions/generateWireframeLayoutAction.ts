"use server";

export interface AiLayoutInputNode {
  id: string;
  tag: string;
  role: "image" | "svg" | "action" | "text";
  text?: string;
  fontClass?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AiLayoutGroup {
  id: string;
  parentId: string;
  tag: "section" | "div" | "ul" | "li" | "nav" | "header" | "footer";
  direction: "row" | "column" | "wrap" | "none";
  listPreset: "none" | "a" | "a-i" | "i-span" | "a-i-span";
  childDonorIds: string[];
}

export interface GenerateWireframeLayoutParams {
  nodes: AiLayoutInputNode[];
  containerWidth?: number;
  previewImage?: string;
}

function parseBase64Image(
  dataUri: string,
): { mimeType: string; data: string } | null {
  const commaIdx = dataUri.indexOf(",");
  if (dataUri.startsWith("data:") && commaIdx !== -1) {
    const meta = dataUri.slice(5, commaIdx);
    const mimeType = (meta.split(";")[0] || "image/jpeg").toLowerCase();
    // Gemini inlineData не принимает image/svg+xml
    if (mimeType === "image/svg+xml") return null;
    const data = dataUri.slice(commaIdx + 1).trim();
    return data ? { mimeType, data } : null;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(dataUri.trim().slice(0, 100))) {
    return { mimeType: "image/jpeg", data: dataUri.trim() };
  }
  return null;
}

export interface GenerateWireframeLayoutResult {
  success: boolean;
  groups?: AiLayoutGroup[];
  error?: string;
}

const SYSTEM_PROMPT = `
You are a Senior Frontend & UI Layout Architect.
Your job is to group flat Figma elements (with 1x screen coordinates x, y, w, h, tag, role, text, fontClass) into a clean semantic HTML layout tree.
When a visual preview screenshot of the section is provided in the input, examine the image to visually verify layout containers, rows, columns, grids, lists (<ul> / <li>), cards, and button placements, and use both the visual image and the geometric nodes list to group elements into an optimal semantic HTML layout tree.

RULES:
1. Output a FLAT array "groups" representing containers using "id" (e.g. "g1", "g2") and "parentId" ("" for root).
2. Place EVERY input node ID into "childDonorIds" of EXACTLY ONE group. Never invent new donor IDs, never duplicate an ID across groups, and never omit any input node ID.
3. Semantic Lists (<ul> / <li>):
   - Identify groups of repeating or semantically related list items: navigation links, feature blocks, cards, pricing plans, steps, grid items, testimonials, FAQ items, icon+text rows.
   - IMPORTANT: Cards/items inside the SAME <ul> MAY have slightly different inner content! For example, item #1 might have [image, title, text, badge], while item #2 has [image, title, text], or item #1 has an icon and item #2 has a photo. If they visually and semantically form a series/grid/list of items in the section, group them into ONE <ul> with separate <li> groups inside!
   - NEVER put a section heading (e.g. h1/h2 above the list) or intro paragraph or standalone CTA button below the list inside <ul> — keep them outside <ul> as siblings inside the parent <section>/<div>.
   - Choose "direction" for <ul>:
     - "row": items arranged horizontally in one line.
     - "column": items stacked vertically one under another (each <li> may internally be a horizontal row like icon+text, or vertical stack).
     - "wrap": 2D grid of cards across multiple rows.
   - Choose "listPreset" for <ul> ONLY when each <li> is a simple menu/nav/feature item (not rich multi-paragraph cards with images):
     - "a": simple text links (ul > li > a)
     - "a-i": clickable icon+text links without extra span
     - "i-span": non-clickable icon + single text item (ul > li > i + span)
     - "a-i-span": clickable link with icon + text (ul > li > a > i + span)
     - "none": leave inner elements as-is (always use "none" for rich cards with headings + descriptions or images).
4. Layout Containers (<div> / <section> / <header> / <footer> / <nav>):
   - Create a root "section" (or "header"/"footer") group when appropriate.
   - When distinct blocks sit side-by-side (e.g. left text column + right image, or 2 columns), create a parent "div" with direction "row" and child column "div" groups with direction "column".
   - Do not create redundant empty wrapper groups that contain nothing and have no child groups.
5. Keep ordering natural (top-to-bottom, left-to-right).
`;

export async function generateWireframeLayoutAction(
  params: GenerateWireframeLayoutParams,
): Promise<GenerateWireframeLayoutResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not defined in environment variables (.env)",
    };
  }

  if (!Array.isArray(params.nodes) || params.nodes.length === 0) {
    return {
      success: false,
      error: "No Figma nodes provided for AI layout",
    };
  }

  const parts: any[] = [];

  if (params.previewImage) {
    const imgInfo = parseBase64Image(params.previewImage);
    if (imgInfo) {
      parts.push({
        inlineData: {
          mimeType: imgInfo.mimeType,
          data: imgInfo.data,
        },
      });
    }
  }

  const userPrompt = `
Viewport/container width: ${params.containerWidth || 1440}px.
Total nodes: ${params.nodes.length}.${params.previewImage ? "\nA visual preview screenshot of the section is attached above. Use it to verify visual grouping, card boundaries, columns, headers, and list arrangements." : ""}

Analyze these Figma nodes and group them into semantic layout containers (section, div, ul, li, nav, etc.):

${JSON.stringify(params.nodes)}
`;

  parts.push({ text: userPrompt });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
        responseSchema: {
          type: "OBJECT",
          properties: {
            groups: {
              type: "ARRAY",
              description: "Flat list of semantic layout containers",
              items: {
                type: "OBJECT",
                properties: {
                  id: {
                    type: "STRING",
                    description: "Unique group ID like g1, g2, g3",
                  },
                  parentId: {
                    type: "STRING",
                    description:
                      "Parent group ID, or empty string '' for root group",
                  },
                  tag: {
                    type: "STRING",
                    enum: [
                      "section",
                      "div",
                      "ul",
                      "li",
                      "nav",
                      "header",
                      "footer",
                    ],
                  },
                  direction: {
                    type: "STRING",
                    enum: ["row", "column", "wrap", "none"],
                  },
                  listPreset: {
                    type: "STRING",
                    enum: ["none", "a", "a-i", "i-span", "a-i-span"],
                  },
                  childDonorIds: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description:
                      "Exact IDs from input nodes placed directly in this group",
                  },
                },
                required: [
                  "id",
                  "parentId",
                  "tag",
                  "direction",
                  "listPreset",
                  "childDonorIds",
                ],
              },
            },
          },
          required: ["groups"],
        },
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `Gemini API error (${response.status}): ${errText.slice(0, 300)}`,
      };
    }

    const data = await response.json();
    const partsList = data?.candidates?.[0]?.content?.parts;
    const rawJson = Array.isArray(partsList)
      ? (partsList.find((p: any) => !p?.thought && typeof p?.text === "string")
          ?.text ?? partsList[0]?.text)
      : undefined;

    if (!rawJson) {
      return {
        success: false,
        error: "Gemini did not return any layout groups",
      };
    }

    const parsed = JSON.parse(rawJson);
    const groups = Array.isArray(parsed?.groups) ? parsed.groups : [];

    return {
      success: true,
      groups,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || String(err),
    };
  }
}
