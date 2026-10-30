// ---Критерий 1: Независимость от интерфейса (UI-Agnostic)
// Тест: «Сможет ли этот код работать в терминале (Node.js) или на бэкенде без браузера, React/Vue и CSS?»
// Ваши функции extractStylesAndScriptsFromNodes и mergeScriptsWithoutDuplicates этот тест проходят. Им плевать, как нарисован интерфейс (кнопками, холстом или терминалом). Они оперируют только данными дерева.
// ---Критерий 2: Владение правилами предметной области (Business / Domain Logic)
// Модель — это не просто структура базы данных (DTO), это правила работы вашего приложения:
// Как объединять стили?
// Как валидировать узел дерева?
// Что считается строчным контейнером?
// ---Критерий 3: Управление состоянием (State & Data Lifecycle)
// К модели относятся:
// Типы данных сущностей (HtmlNode, схемы).
// Мутации и вычисления над этими данными.
// Методы сохранения/чтения (репозитории, API, LocalStorage с DB_KEY).
import type { HtmlNode } from "@/types/HtmlNode";
import { generateNodeKey, findNodeByKey } from "@/lib/htmlTree";

export function sanitizeCssBody(css: string): string {
  return css.replace(/\}\s*;/g, "}").trim();
}

export const getNodeKey = (node: HtmlNode | null | undefined): string =>
  node?._key || (node as any)?.id || "";

/**
 * 🔹 Гарантирует уникальность и наличие ключей у всех узлов дерева
 */
export function ensureUniqueKeys(nodes: HtmlNode[]): HtmlNode[] {
  return nodes.map((node) => ({
    ...node,
    _key:
      node._key ||
      `${node.tag || "node"}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    children: Array.isArray(node.children)
      ? ensureUniqueKeys(node.children)
      : node.children,
  }));
}

/**
 * 🔹 Рекурсивно собирает ключи всех узлов-контейнеров (имеющих children)
 */
export function getAllCollapsibleKeys(
  nodes: HtmlNode[] | null | undefined,
): string[] {
  if (!nodes || !Array.isArray(nodes)) return [];
  const keys: string[] = [];

  function traverse(list: HtmlNode[]) {
    for (const node of list) {
      if (Array.isArray(node.children) && node.children.length > 0) {
        if (node._key) keys.push(node._key);
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return keys;
}

/**
 * 🔹 Ищет узел в дереве по критериям выделения из PreviewArea
 * (прямой ключ -> специфичный CSS-класс -> тег + совпадение текста)
 */
export function findNodeByCriteria(
  nodes: HtmlNode[],
  criteria: {
    key?: string | null;
    className?: string;
    tag?: string;
    text?: string;
  },
): HtmlNode | null {
  const { key, className, tag, text } = criteria;

  if (key) {
    for (const root of nodes) {
      const found = findNodeByKey(root, key);
      if (found) return found;
    }
  }

  const findFallback = (list: HtmlNode[]): HtmlNode | null => {
    for (const node of list) {
      if (className && node.class) {
        const classes = node.class.split(/\s+/).filter(Boolean);
        const targetClasses = className.trim().split(/\s+/).filter(Boolean);
        const specificClass = targetClasses[targetClasses.length - 1]?.replace(
          /^\./,
          "",
        );
        if (specificClass && classes.includes(specificClass)) {
          return node;
        }
      }

      if (
        text &&
        node.text?.trim() === text.trim() &&
        (!tag || node.tag === tag)
      ) {
        return node;
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        const found = findFallback(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  return findFallback(nodes);
}

/** Рекурсивно находит узел в дереве */
export function findNodeInTree(nodes: HtmlNode[], key: string): HtmlNode | null {
  if (!Array.isArray(nodes)) return null;
  for (const n of nodes) {
    if (getNodeKey(n) === key) return n;
    if (Array.isArray(n.children)) {
      const f = findNodeInTree(n.children, key);
      if (f) return f;
    }
  }
  return null;
}

/** Рекурсивно собирает ключ самого узла и ВСЕХ его потомков на любую глубину */
export function collectAllDescendantKeys(node: HtmlNode | null | undefined): string[] {
  if (!node) return [];
  const keys: string[] = [];
  function walk(n: HtmlNode) {
    const k = getNodeKey(n);
    if (k) keys.push(k);
    if (Array.isArray(n?.children)) {
      for (const child of n.children) {
        walk(child);
      }
    }
  }
  walk(node);
  return keys;
}

/** Удаляет указанные ключи из дерева на любую глубину */
export function removeNodesByKeys(nodes: HtmlNode[], keys: Set<string>): HtmlNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n) => !keys.has(getNodeKey(n)))
    .map((n) => {
      if (Array.isArray(n.children)) {
        return {
          ...n,
          children: removeNodesByKeys(n.children, keys),
        };
      }
      return n;
    });
}

/** Извлекает ноды с указанными ключами */
export function extractNodesByKeys(nodes: HtmlNode[], keys: Set<string>): HtmlNode[] {
  if (!Array.isArray(nodes)) return [];
  const found: HtmlNode[] = [];
  function walk(list: HtmlNode[]) {
    for (const item of list) {
      if (keys.has(getNodeKey(item))) {
        found.push(item);
      } else if (Array.isArray(item.children)) {
        walk(item.children);
      }
    }
  }
  walk(nodes);
  return found;
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
 * 🔹 ИЗВЛЕЧЕНИЕ СТИЛЕЙ И СКРИПТОВ
 * Гарантирует, что стили ВСЕГДА завернуты в селектор класса, даже если у ноды не было класса!
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

      // Для svg и его дочерних элементов (path, g...) не генерируем искусственные классы
      const isSvgElement = [
        "svg",
        "path",
        "g",
        "circle",
        "rect",
        "polygon",
        "polyline",
      ].includes(tag);

      // Берем первый нормальный класс элемента (не утилиты типа flex/grid)
      let targetClass = classList.find(
        (c) =>
          !c.includes(":") && !c.startsWith("flex") && !c.startsWith("grid"),
      );

      // Если класса не было и это НЕ элемент SVG — даем имя по тегу (если нужно),
      // а для SVG оставляем инлайн-стиль или пропускаем создание мусорного класса
      if (!targetClass && !isSvgElement) {
        targetClass = `${tag}-custom`;
        classList.push(targetClass);
      }

      if (targetClass) {
        if (cleanBody.startsWith(`.${targetClass}`)) {
          extractedRules.push(cleanBody);
        } else {
          extractedRules.push(`.${targetClass} {\n  ${cleanBody}\n}`);
        }
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
    const match = rule.match(/^\.([a-zA-Z0-9_-]+)/);
    if (match) {
      const className = match[1];

      const regex = new RegExp(`\\.${className}\\s*\\{`);
      if (!regex.test(result)) {
        result = `${result.trim()}\n\n${rule}`;
      } else {
        console.log(
          `[SCSS] Класс .${className} уже есть в файле, дубль пропущен.`,
        );
      }
    } else {
      if (!result.includes(rule)) {
        result = `${result.trim()}\n\n${rule}`;
      }
    }
  }

  return result.trim();
}

/**
 * 🔹 НАДЕЖНЫЙ МЕРДЖ СКРИПТОВ БЕЗ МУСОРА И ДУБЛИКАТОВ
 */
export function mergeScriptsWithoutDuplicates(
  currentBundle: string,
  incomingScripts: { name: string; code: string }[],
): string {
  if (!incomingScripts || incomingScripts.length === 0) return currentBundle;

  let result = (currentBundle || "").trim();

  for (const script of incomingScripts) {
    const name = script.name.trim();
    let cleanCode = script.code
      .replace(/\/\*\s*@component:\s*.*?\*\//g, "")
      .replace(/\/\*\s*@end:\s*.*?\*\//g, "")
      .trim();

    if (!cleanCode) continue;

    const blockRegex = new RegExp(
      `\\/\\*\\s*@component:\\s*${name}\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*@end:\\s*${name}\\s*\\*\\/`,
      "g",
    );

    const formattedBlock = `/* @component: ${name} */\n${cleanCode}\n/* @end: ${name} */`;

    if (blockRegex.test(result)) {
      const existingMatch = result.match(blockRegex);
      if (existingMatch && existingMatch[0].trim() === formattedBlock.trim()) {
        console.log(
          `[JS Bundle] Скрипт "${name}" уже существует без изменений, дубль пропущен.`,
        );
      } else {
        result = result.replace(blockRegex, formattedBlock);
        console.log(`[JS Bundle] Скрипт "${name}" обновлен.`);
      }
    } else {
      result = result ? `${result}\n\n${formattedBlock}` : formattedBlock;
      console.log(`[JS Bundle] Скрипт "${name}" добавлен в бандл.`);
    }
  }

  return result.trim();
}
