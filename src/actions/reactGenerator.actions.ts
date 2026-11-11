"use server";

export interface GeneratedComponent {
  name: string;
  path: string;
  code: string;
}

export interface GenerateReactResult {
  success: boolean;
  appCode?: string;
  components?: GeneratedComponent[];
  error?: string;
}

export interface GenerateReactParams {
  html: string;
  js?: string;
  css?: string;
}

const SYSTEM_PROMPT = `
You are a Senior React & TypeScript Architect.
Your task is to convert an HTML/Tailwind page layout and its JavaScript interactivity into a modern, production-ready React 19 + TypeScript application.

REQUIREMENTS:
1. Decomposition:
   - Identify logical sections (e.g. Header, Hero, Features, Pricing, Testimonials, Footer, Modals) and repeated cards/items.
   - Extract them into clean, modular components inside "src/components/{ComponentName}.tsx".
   - Define TypeScript "interface {ComponentName}Props" for components that accept props.
   - In "src/App.tsx", import all components and compose the page.

2. State & Interactivity:
   - Analyze any provided JavaScript code (DOM manipulations, event listeners, mobile menu toggles, modal open/close, tab switches, dropdowns).
   - Convert all imperative DOM logic into idiomatic, declarative React "useState", "useCallback", and "useEffect" hooks.
   - Replace "onclick" or event listeners with React event handlers (e.g. onClick, onChange).

3. Styling & Attributes:
   - Use Tailwind CSS classes (convert HTML "class" to "className", "for" to "htmlFor").
   - Preserve all Tailwind utility classes from the original HTML.
   - For inline styles, convert them to React style objects (e.g. style={{ width: "100%" }}).
   - For SVG icons, use "<svg className='...' viewBox='...'><use href='#icon-name' xlinkHref='#icon-name' /></svg>".
   - For images, keep paths like "assets/image-name.webp".

4. Code Quality:
   - Modern React with functional components and named/default exports.
   - Strict TypeScript syntax, clean formatting, no placeholders or ellipsis (...).
`;

export async function generateReactProjectAction(
  params: GenerateReactParams,
): Promise<GenerateReactResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not defined in environment variables (.env)",
    };
  }

  const userPrompt = `
Here is the HTML layout and interactivity to transform into React:

--- HTML LAYOUT ---
${params.html || "<div>No HTML provided</div>"}

--- JAVASCRIPT LOGIC ---
${params.js?.trim() ? params.js : "// No custom JavaScript logic"}

--- CUSTOM CSS / TOKENS ---
${params.css?.trim() ? params.css.slice(0, 3000) : "/* Tailwind utility classes only */"}

Please decompose this layout into logical React TypeScript components and provide the complete App.tsx and all child components.
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
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
            appCode: {
              type: "STRING",
              description:
                "Complete TypeScript code for src/App.tsx that connects all child components",
            },
            components: {
              type: "ARRAY",
              description: "Decomposed reusable React components",
              items: {
                type: "OBJECT",
                properties: {
                  name: {
                    type: "STRING",
                    description: "PascalCase component name, e.g. Header, HeroSection, FeatureCard",
                  },
                  path: {
                    type: "STRING",
                    description:
                      "File path relative to project root, e.g. src/components/Header.tsx",
                  },
                  code: {
                    type: "STRING",
                    description:
                      "Complete TypeScript code of the component with imports, props interface, and Tailwind styles",
                  },
                },
                required: ["name", "path", "code"],
              },
            },
          },
          required: ["appCode", "components"],
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
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawJson) {
      return {
        success: false,
        error: "Gemini did not return any content in response",
      };
    }

    const parsed = JSON.parse(rawJson);

    return {
      success: true,
      appCode: parsed.appCode || "",
      components: parsed.components || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || String(err),
    };
  }
}
