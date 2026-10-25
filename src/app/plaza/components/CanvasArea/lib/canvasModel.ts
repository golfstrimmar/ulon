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
 * Парсер, разбивающий SCSS на блоки верхнего уровня с учётом любой вложенности ({... { ... } ...})
 */
// function splitScssIntoTopLevelRules(
//   scss: string,
// ): { selector: string; fullRule: string }[] {
//   const rules: { selector: string; fullRule: string }[] = [];
//   let depth = 0;
//   let currentSelector = "";
//   let currentBlockStart = -1;
//   let insideSelector = true;

//   for (let i = 0; i < scss.length; i++) {
//     const char = scss[i];

//     if (char === "{") {
//       if (depth === 0) {
//         currentBlockStart = i;
//         insideSelector = false;
//       }
//       depth++;
//     } else if (char === "}") {
//       depth--;
//       if (depth === 0 && currentBlockStart !== -1) {
//         const fullRule = scss
//           .slice(currentBlockStart - currentSelector.length, i + 1)
//           .trim();
//         const cleanSelector = currentSelector.trim();
//         if (cleanSelector) {
//           rules.push({ selector: cleanSelector, fullRule });
//         }
//         currentSelector = "";
//         currentBlockStart = -1;
//         insideSelector = true;
//       }
//     } else if (insideSelector && depth === 0) {
//       currentSelector += char;
//     }
//   }

//   return rules;
// }

/**
 * 🔹 ИЗВЛЕЧЕНИЕ СТИЛЕЙ И СКРИПТОВ
 * Гарантирует, что стили ВСЕГДА завернуты в селектор класса, даже если у ноды не было класса!
 */
/**
 * 1. ИЗВЛЕКАЕМ СТИЛИ: ЖЕСТКО ПРИВЯЗЫВАЕМ СТИЛЬ К КЛАССУ ЭЛЕМЕНТА
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

    // 1. Скрипты
    if (tag === "script") {
      const code = (node.text || "").trim();
      if (code) {
        const componentMatch = /\/\*\s*@component:\s*\.?([a-zA-Z0-9_-]+)/.exec(
          code,
        );
        const scriptName = componentMatch
          ? componentMatch[1]
          : classList[0] || `${tag}-script`;
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
      const scriptName = componentMatch
        ? componentMatch[1]
        : classList[0] || `${tag}-script`;
      extractedScripts.push({ name: scriptName, code });
    }

    // 2. Стили — ВСЕГДА В ОБЕРТКЕ СВОЕГО КЛАССА
    if (node.style && node.style.trim()) {
      const cleanBody = node.style.trim();

      // Берем первый нормальный класс элемента (не утилиты типа flex/grid)
      let targetClass = classList.find(
        (c) =>
          !c.includes(":") && !c.startsWith("flex") && !c.startsWith("grid"),
      );

      // Если класса вообще не было, даем по тегу
      if (!targetClass) {
        targetClass = `${tag}-custom`;
        classList.push(targetClass);
      }

      // Если в JSON стиль случайно уже был завернут в .класс { ... }, не оборачиваем второй раз
      if (cleanBody.startsWith(`.${targetClass}`)) {
        extractedRules.push(cleanBody);
      } else {
        extractedRules.push(`.${targetClass} {\n  ${cleanBody}\n}`);
      }
    }

    // Рекурсия по дочерним
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

/**
 * 2. ДУБОВАЯ ПРОВЕРКА ПО КЛАССАМ:
 * Пришел класс — смотрим, есть ли уже такой в файле.
 * Есть — пропускаем. Нет — дописываем в конец.
 */
export function mergeScssWithoutDuplicates(
  currentScss: string,
  incomingScss: string,
): string {
  if (!incomingScss.trim()) return currentScss;
  if (!currentScss.trim()) return incomingScss.trim();

  // Разбиваем входящий блок по правилам (каждое начинается с точки: .имя-класса {)
  const incomingRules = incomingScss
    .split(/\n(?=\.[a-zA-Z0-9_-]+\s*\{)/g)
    .map((r) => r.trim())
    .filter(Boolean);

  let result = currentScss;

  for (const rule of incomingRules) {
    // Извлекаем имя класса из правила, например: .field-t
    const match = rule.match(/^\.([a-zA-Z0-9_-]+)/);
    if (match) {
      const className = match[1];

      // Проверяем: есть ли уже .className { в текущем файле стилей
      const regex = new RegExp(`\\.${className}\\s*\\{`);
      if (!regex.test(result)) {
        // Такого класса еще нет — дописываем!
        result = `${result.trim()}\n\n${rule}`;
      } else {
        // Класс уже есть — пропускаем дубль!
        console.log(
          `[SCSS] Класс .${className} уже есть в файле, дубль пропущен.`,
        );
      }
    } else {
      // На крайний случай: если правило не с точки, но его еще нет в тексте
      if (!result.includes(rule)) {
        result = `${result.trim()}\n\n${rule}`;
      }
    }
  }

  return result.trim();
}
/**
 * 🔹 НАДЕЖНЫЙ МЕРДЖ СКРИПТОВ БЕЗ МУСОРА И ДУБЛИКАТОВ
 * Ищет блок /* @component: name * / ... /* @end: name * /
 * - Если блока нет — добавляет в конец.
 * - Если блок есть и код тот же — пропускает.
 * - Если код изменился — заменяет только его тело.
 */
export function mergeScriptsWithoutDuplicates(
  currentBundle: string,
  incomingScripts: { name: string; code: string }[],
): string {
  if (!incomingScripts || incomingScripts.length === 0) return currentBundle;

  let result = (currentBundle || "").trim();

  for (const script of incomingScripts) {
    const name = script.name.trim();
    // Очищаем пришедший код от старых внешних меток, если они уже были
    let cleanCode = script.code
      .replace(/\/\*\s*@component:\s*.*?\*\//g, "")
      .replace(/\/\*\s*@end:\s*.*?\*\//g, "")
      .trim();

    if (!cleanCode) continue;

    // Регулярка для поиска существующего блока этого компонента
    const blockRegex = new RegExp(
      `\\/\\*\\s*@component:\\s*${name}\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*@end:\\s*${name}\\s*\\*\\/`,
      "g",
    );

    const formattedBlock = `/* @component: ${name} */\n${cleanCode}\n/* @end: ${name} */`;

    if (blockRegex.test(result)) {
      // Блок с таким именем уже есть!
      // Сравниваем: если код внутри точно такой же — ничего не трогаем (пропускаем дубль)
      const existingMatch = result.match(blockRegex);
      if (existingMatch && existingMatch[0].trim() === formattedBlock.trim()) {
        console.log(
          `[JS Bundle] Скрипт "${name}" уже существует без изменений, дубль пропущен.`,
        );
      } else {
        // Код изменился — аккуратно обновляем именно этот блок
        result = result.replace(blockRegex, formattedBlock);
        console.log(`[JS Bundle] Скрипт "${name}" обновлен.`);
      }
    } else {
      // Такого скрипта еще нет вообще — дописываем в конец бандла
      result = result ? `${result}\n\n${formattedBlock}` : formattedBlock;
      console.log(`[JS Bundle] Скрипт "${name}" добавлен в бандл.`);
    }
  }

  return result.trim();
}
