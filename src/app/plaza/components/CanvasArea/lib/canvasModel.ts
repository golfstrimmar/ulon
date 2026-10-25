import type { HtmlNode } from "@/types/HtmlNode";
import { generateNodeKey } from "@/lib/htmlTree";

export const DB_KEY = "plaza_tree";

export const DEPTH_BG = [
  "rgba(18, 18, 24, 0.96)",
  "rgba(26, 26, 34, 0.96)",
  "rgba(34, 34, 44, 0.96)",
  "rgba(42, 42, 54, 0.96)",
  "rgba(50, 50, 64, 0.96)",
];

export const DEPTH_BORDER = [
  "rgba(63, 63, 70, 0.8)",
  "rgba(82, 82, 91, 0.85)",
  "rgba(113, 113, 122, 0.9)",
  "rgba(161, 161, 170, 0.9)",
  "rgba(212, 212, 216, 0.9)",
];

export const COMMON_TAGS = [
  "div",
  "p",
  "span",
  "button",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "section",
  "header",
  "footer",
  "main",
  "nav",
  "aside",
  "article",
  "ul",
  "ol",
  "li",
  "input",
  "form",
  "label",
  "img",
];

export interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside";
}

export function sanitizeCssBody(css: string): string {
  return css.replace(/\}\s*;/g, "}").trim();
}

export function isRowContainer(node: HtmlNode): boolean {
  const raw = (node.class || "").toLowerCase();
  const cls = raw.replace(/[-_]/g, " ");

  if (
    raw.includes("flex-col") ||
    raw.includes("flex-column") ||
    cls.includes("flex col") ||
    cls.includes("flex column")
  ) {
    return false;
  }

  if (
    raw.includes("flex-row") ||
    cls.includes("flex row") ||
    raw.includes("ul-flex-row") ||
    raw.includes("grid")
  ) {
    return true;
  }

  return raw.includes("flex");
}

/**
 * Извлекает инлайн-стили и скрипты из нод дерева, возвращая очищенные ноды
 */
export function extractStylesAndScriptsFromNodes(nodes: HtmlNode[]): {
  cleanNodes: HtmlNode[];
  extractedScss: string;
  extractedScripts: { name: string; code: string }[];
} {
  const extractedRules: string[] = [];
  const extractedScripts: { name: string; code: string }[] = [];

  function processNode(node: HtmlNode): HtmlNode | null {
    const key = node._key || generateNodeKey();
    const tag = (node.tag || "div").toLowerCase();
    let classList = (node.class || "").split(/\s+/).filter(Boolean);
    const targetName = classList[0] || `${tag}-${key.slice(-5)}`;

    if (tag === "script") {
      const code = (node.text || "").trim();
      if (code) {
        const componentMatch = /\/\*\s*@component:\s*\.?([a-zA-Z0-9_-]+)/.exec(
          code,
        );
        const scriptName = componentMatch ? componentMatch[1] : targetName;
        extractedScripts.push({ name: scriptName, code });
      }
      return null;
    }

    const anyNode = node as any;
    const directScript = anyNode.script || anyNode.js;
    if (typeof directScript === "string" && directScript.trim()) {
      const code = directScript.trim();
      const componentMatch = /\/\*\s*@component:\s*\.?([a-zA-Z0-9_-]+)/.exec(
        code,
      );
      const scriptName = componentMatch ? componentMatch[1] : targetName;
      extractedScripts.push({ name: scriptName, code });
    }

    if (node.style && node.style.trim()) {
      const cleanBody = sanitizeCssBody(node.style);
      let targetClass = classList.find(
        (c) =>
          !c.includes(":") && !c.startsWith("flex") && !c.startsWith("grid"),
      );

      if (!targetClass) {
        targetClass = `${tag.replace(/[^a-z0-9]/g, "")}-${key.slice(-5)}`;
        classList.push(targetClass);
      }
      extractedRules.push(`.${targetClass} {\n  ${cleanBody}\n}`);
    }

    let processedChildren: HtmlNode[] = [];
    if (Array.isArray(node.children)) {
      processedChildren = node.children
        .map(processNode)
        .filter(Boolean) as HtmlNode[];
    }

    const cleaned: any = {
      ...node,
      _key: key,
      class: classList.length > 0 ? classList.join(" ") : undefined,
      children: processedChildren,
    };
    delete cleaned.style;
    delete cleaned.script;
    delete cleaned.js;

    return cleaned;
  }

  const cleanNodes = nodes.map(processNode).filter(Boolean) as HtmlNode[];
  return {
    cleanNodes,
    extractedScss: extractedRules.join("\n\n"),
    extractedScripts,
  };
}
