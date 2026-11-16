import type { HtmlNode } from "@/types/HtmlNode";
import {
  generateNodeKey,
  findNodeByKey,
  removeNodeFromTree,
  isDescendant,
  duplicateNodeInTree,
} from "@/lib/htmlTree";

/**
 * Очищает тело CSS от некорректных точек с запятой перед закрывающими фигурными скобками ("};" -> "}")
 * и удаляет лишние пробелы по краям.
 */
export function sanitizeCssBody(css: string): string {
  return css.replace(/\}\s*;/g, "}").trim();
}

/**
 * Возвращает уникальный идентификатор узла (_key или id).
 */
export const getNodeKey = (node: HtmlNode | null | undefined): string =>
  node?._key || (node as any)?.id || "";

/**
 * Гарантирует наличие уникальных ключей (_key) для всех узлов в дереве.
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
 * Рекурсивно собирает ключи всех узлов-контейнеров (узлов, имеющих дочерние элементы).
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
 * Переключает состояние сворачивания всех контейнеров:
 * если все контейнеры уже свёрнуты — разворачивает всё, иначе сворачивает всё.
 */
export function computeToggledCollapsedKeys(
  tree: HtmlNode[],
  currentCollapsed: Set<string>,
): Set<string> {
  const allKeys = getAllCollapsibleKeys(tree);
  if (allKeys.length === 0) return new Set();
  const allCollapsed = allKeys.every((k) => currentCollapsed.has(k));
  return allCollapsed ? new Set() : new Set(allKeys);
}

/**
 * Иммутабельно переключает имя папки в Set открытых папок сайдбара.
 */
export function toggleFolderInSet(
  prev: Set<string>,
  folderName: string,
): Set<string> {
  const next = new Set(prev);
  if (next.has(folderName)) next.delete(folderName);
  else next.add(folderName);
  return next;
}

/**
 * Проверяет, содержит ли дерево хотя бы один узел.
 */
export function hasTreeNodes(nodes: unknown): boolean {
  return Array.isArray(nodes) && nodes.length > 0;
}

/**
 * Подготавливает ноды из JSON-шаблона к добавлению в дерево:
 * извлекает inline-стили и скрипты, проставляет уникальные ключи
 * и собирает ключи для правой панели при включённом сплит-режиме.
 */
export function prepareAppendedNodes(
  currentTree: HtmlNode[],
  rawData: HtmlNode | HtmlNode[],
  isSplit: boolean,
): {
  nextTree: HtmlNode[];
  extractedScss: string;
  extractedScripts: { name: string; code: string }[];
  addedRightKeys: string[];
} {
  const nodes: HtmlNode[] = Array.isArray(rawData) ? rawData : [rawData];
  const { cleanNodes, extractedScss, extractedScripts } =
    extractStylesAndScriptsFromNodes(nodes);

  const nodesWithUniqueKeys = ensureUniqueKeys(cleanNodes);
  const nextTree = [...currentTree, ...nodesWithUniqueKeys];

  const addedRightKeys: string[] = [];
  if (isSplit) {
    for (const node of nodesWithUniqueKeys) {
      addedRightKeys.push(...collectAllDescendantKeys(node));
    }
  }

  return {
    nextTree,
    extractedScss,
    extractedScripts,
    addedRightKeys,
  };
}
/**
 * Находит узел по набору критериев (ключ, класс, тег, текстовое содержимое).
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

/**
 * Рекурсивно находит узел в дереве по его ключу.
 */
export function findNodeInTree(
  nodes: HtmlNode[],
  key: string,
): HtmlNode | null {
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

/**
 * Собирает ключ самого узла и ключи всех его дочерних элементов (потомков).
 */
export function collectAllDescendantKeys(
  node: HtmlNode | null | undefined,
): string[] {
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

/**
 * Удаляет из дерева узлы с указанными ключами.
 */
export function removeNodesByKeys(
  nodes: HtmlNode[],
  keys: Set<string>,
): HtmlNode[] {
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

/**
 * Извлекает (находит и возвращает в плоском массиве) узлы по их ключам.
 */
export function extractNodesByKeys(
  nodes: HtmlNode[],
  keys: Set<string>,
): HtmlNode[] {
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

/**
 * Определяет, является ли контейнер строчным (горизонтальным flex-рядом или grid-контейнером),
 * анализируя встроенные стили и CSS-классы.
 */
export function isRowContainer(node: HtmlNode): boolean {
  const rawClass = (node.class || "").toLowerCase();
  const rawStyle = (node.style || "").toLowerCase();

  // 1. Проверка через нативный CSS в style
  if (rawStyle.includes("flex-direction: row")) {
    return true;
  }
  if (rawStyle.includes("flex-direction: column")) {
    return false;
  }

  // 2. Проверка через классы
  const cls = rawClass.replace(/[-_]/g, " ");
  if (
    rawClass.includes("flex-col") ||
    rawClass.includes("flex-column") ||
    cls.includes("flex col")
  ) {
    return false;
  }

  if (
    rawClass.includes("flex-row") ||
    cls.includes("flex row") ||
    rawClass.includes("grid")
  ) {
    return true;
  }

  return rawClass.includes("flex") || rawStyle.includes("display: flex");
}

/**
 * Извлекает inline-стили и теги/свойства скриптов из дерева узлов,
 * формируя чистые SCSS-правила и массив JS-скриптов.
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

    if (node.style && node.style.trim()) {
      const cleanBody = node.style.trim();
      const isSvgElement = [
        "svg",
        "path",
        "g",
        "circle",
        "rect",
        "polygon",
        "polyline",
      ].includes(tag);

      let targetClass = classList.find(
        (c) =>
          !c.includes(":") && !c.startsWith("flex") && !c.startsWith("grid"),
      );

      if (targetClass) {
        if (cleanBody.startsWith(`.${targetClass}`)) {
          extractedRules.push(cleanBody);
        } else {
          extractedRules.push(`.${targetClass} {\n  ${cleanBody}\n}`);
        }
      }
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

/**
 * Разбивает CSS/SCSS строку на блоки верхнего уровня,
 * возвращая селектор, полный текст блока и список классов.
 */
export function splitTopLevelCssBlocks(scss: string): {
  selector: string;
  full: string;
  classes: string[];
}[] {
  const blocks: { selector: string; full: string; classes: string[] }[] = [];
  let depth = 0;
  let selector = "";
  let startIdx = 0;
  const len = scss.length;

  for (let i = 0; i < len; i++) {
    const char = scss[i];

    if (char === "{") {
      if (depth === 0) {
        selector = scss.slice(startIdx, i).trim();
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        const full = scss.slice(startIdx, i + 1).trim();
        const classes: string[] = [];
        const classRegex = /\.([a-zA-Z0-9_-]+)/g;
        let m: RegExpExecArray | null;
        while ((m = classRegex.exec(selector)) !== null) {
          classes.push(m[1]);
        }
        blocks.push({ selector, full, classes });
        startIdx = i + 1;
        selector = "";
      }
    }
  }

  const remainder = scss.slice(startIdx).trim();
  if (remainder) {
    blocks.push({ selector: remainder, full: remainder, classes: [] });
  }

  return blocks;
}

/**
 * Объединяет текущие и входящие SCSS-стили, исключая дубликаты блоков и селекторов.
 */
export function mergeScssWithoutDuplicates(
  currentScss: string,
  incomingScss: string,
): string {
  if (!incomingScss.trim()) return currentScss;
  if (!currentScss.trim()) return incomingScss.trim();

  const currentBlocks = splitTopLevelCssBlocks(currentScss);
  const existingSelectors = new Set<string>();
  const existingClasses = new Set<string>();
  const existingRules = new Set<string>();

  for (const block of currentBlocks) {
    existingRules.add(block.full);
    const norm = block.selector.replace(/\s+/g, " ").trim();
    if (norm) {
      existingSelectors.add(norm);
    }
    for (const cls of block.classes) {
      existingClasses.add(cls);
    }
  }

  const incomingBlocks = splitTopLevelCssBlocks(incomingScss);
  let result = currentScss.trim();

  for (const block of incomingBlocks) {
    if (existingRules.has(block.full)) {
      continue;
    }

    const norm = block.selector.replace(/\s+/g, " ").trim();
    if (norm && existingSelectors.has(norm)) {
      continue;
    }

    if (block.classes.length > 0) {
      result = `${result}\n\n${block.full}`;
      if (norm) {
        existingSelectors.add(norm);
      }
      for (const cls of block.classes) {
        existingClasses.add(cls);
      }
      existingRules.add(block.full);
    } else {
      if (!result.includes(block.full)) {
        result = `${result}\n\n${block.full}`;
        if (norm) {
          existingSelectors.add(norm);
        }
        existingRules.add(block.full);
      }
    }
  }

  return result.trim();
}

/**
 * Объединяет JavaScript-код с новыми скриптами без дублирования,
 * используя маркеры компонентов вида /* @component: name *\/ ... /* @end: name *\/.
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
        continue;
      }
      result = result.replace(blockRegex, formattedBlock);
    } else {
      result = result ? `${result}\n\n${formattedBlock}` : formattedBlock;
    }
  }

  return result.trim();
}

/**
 * Нормализует набор выбранных ключей, возвращая их в порядке следования в DOM-дереве.
 */
export function normalizeSelectedKeys(
  tree: HtmlNode[],
  selectedKeys: Set<string>,
): string[] {
  if (!tree || selectedKeys.size === 0) return [];
  const result: string[] = [];

  function traverse(list: HtmlNode[]) {
    for (const node of list) {
      const key = getNodeKey(node);
      if (key && selectedKeys.has(key)) {
        result.push(key);
      } else if (Array.isArray(node.children) && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return result;
}

/**
 * Вставляет массив узлов рядом с целевым узлом (до или после него) на том же уровне иерархии.
 */
export function insertNodesAdjacent(
  nodes: HtmlNode[],
  targetKey: string,
  nodesToInsert: HtmlNode[],
  position: "before" | "after",
): HtmlNode[] {
  const result: HtmlNode[] = [];
  for (const node of nodes) {
    if (node._key === targetKey) {
      if (position === "before") {
        result.push(...nodesToInsert);
        result.push(node);
      } else {
        result.push(node);
        result.push(...nodesToInsert);
      }
    } else {
      if (Array.isArray(node.children)) {
        result.push({
          ...node,
          children: insertNodesAdjacent(
            node.children,
            targetKey,
            nodesToInsert,
            position,
          ),
        });
      } else {
        result.push(node);
      }
    }
  }
  return result;
}

/**
 * Вставляет массив узлов внутрь целевого узла (в конец списка его дочерних элементов).
 */
export function insertNodesInside(
  nodes: HtmlNode[],
  targetKey: string,
  nodesToInsert: HtmlNode[],
): HtmlNode[] {
  return nodes.map((node) => {
    if (node._key === targetKey) {
      return {
        ...node,
        children: [
          ...(Array.isArray(node.children) ? node.children : []),
          ...nodesToInsert,
        ],
      };
    }
    if (Array.isArray(node.children)) {
      return {
        ...node,
        children: insertNodesInside(node.children, targetKey, nodesToInsert),
      };
    }
    return node;
  });
}

/**
 * Перемещает группу узлов в новую позицию относительно целевого узла (до, после или внутрь).
 * Включает проверку на перемещение родителя внутрь собственного потомка.
 */
export function moveNodesGroup(
  tree: HtmlNode[],
  sourceKeys: string[],
  targetKey: string,
  position: "before" | "after" | "inside",
): HtmlNode[] {
  if (!tree || sourceKeys.length === 0 || !targetKey) return tree;
  if (sourceKeys.includes(targetKey)) return tree;

  for (const key of sourceKeys) {
    const node = findNodeInTree(tree, key);
    if (node && isDescendant(node, targetKey)) {
      return tree;
    }
  }

  let currentTree = tree;
  const nodesToMove: HtmlNode[] = [];

  for (const key of sourceKeys) {
    const { updatedNodes, removedNode } = removeNodeFromTree(currentTree, key);
    if (removedNode) {
      nodesToMove.push(removedNode);
      currentTree = updatedNodes;
    }
  }

  if (nodesToMove.length === 0) return tree;

  if (position === "inside") {
    return insertNodesInside(currentTree, targetKey, nodesToMove);
  } else {
    return insertNodesAdjacent(currentTree, targetKey, nodesToMove, position);
  }
}

/**
 * Дублирует группу узлов по их ключам в структуре дерева.
 */
export function duplicateNodesGroup(
  tree: HtmlNode[],
  sourceKeys: string[],
): HtmlNode[] {
  let currentTree = tree;
  for (const key of sourceKeys) {
    currentTree = duplicateNodeInTree(currentTree, key);
  }
  return currentTree;
}
/**
 * Собирает все ключи узлов в дереве.
 */
export function collectAllTreeKeys(nodes: HtmlNode[]): Set<string> {
  const keys = new Set<string>();
  function walk(list: HtmlNode[]) {
    for (const node of list) {
      const k = getNodeKey(node);
      if (k) keys.add(k);
      if (Array.isArray(node.children)) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return keys;
}

/**
 * Находит корневые ключи новых клонированных контейнеров (узлов с детьми),
 * которых не было в исходном наборе ключей.
 */
export function findNewCollapsibleRootKeys(
  nodes: HtmlNode[],
  existingKeys: Set<string>,
): string[] {
  const result: string[] = [];
  function walk(list: HtmlNode[]) {
    for (const node of list) {
      const k = getNodeKey(node);
      if (k && !existingKeys.has(k)) {
        if (Array.isArray(node.children) && node.children.length > 0) {
          result.push(k);
        }
        continue;
      }
      if (Array.isArray(node.children)) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return result;
}
/**
 * Объединяет данные узлов-доноров (текст, классы, атрибуты, детей) в целевой узел,
 * после чего удаляет узлы-доноры из дерева.
 */
export function mergeDonorIntoTarget(
  tree: HtmlNode[],
  donorKeys: string[],
  targetKey: string,
): HtmlNode[] {
  if (!tree || donorKeys.length === 0 || !targetKey) return tree;
  if (donorKeys.includes(targetKey)) return tree;

  const targetNode = findNodeInTree(tree, targetKey);
  if (!targetNode) return tree;

  const donorNodes: HtmlNode[] = [];
  for (const dKey of donorKeys) {
    const dNode = findNodeInTree(tree, dKey);
    if (dNode) donorNodes.push(dNode);
  }
  if (donorNodes.length === 0) return tree;

  let nextText = targetNode.text;
  const currentClasses = new Set<string>(
    (targetNode.class || "").trim().split(/\s+/).filter(Boolean),
  );
  const nextAttributes: Record<string, string> = {
    ...(targetNode.attributes || {}),
  };
  const appendedChildren: HtmlNode[] = [];

  for (const donor of donorNodes) {
    if (typeof donor.text === "string" && donor.text.trim() !== "") {
      nextText = donor.text;
    }

    if (donor.class) {
      donor.class
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .forEach((cls) => currentClasses.add(cls));
    }

    if (donor.attributes && typeof donor.attributes === "object") {
      Object.assign(nextAttributes, donor.attributes);
    }

    if (Array.isArray(donor.children) && donor.children.length > 0) {
      appendedChildren.push(...donor.children);
    }
  }

  const nextClass = Array.from(currentClasses).join(" ");
  const donorSet = new Set(donorKeys);
  const treeWithoutDonors = removeNodesByKeys(tree, donorSet);

  function updateTargetInList(nodes: HtmlNode[]): HtmlNode[] {
    return nodes.map((item) => {
      if (getNodeKey(item) === targetKey) {
        const existingChildren = Array.isArray(item.children)
          ? item.children
          : [];
        return {
          ...item,
          text: nextText,
          class: nextClass,
          attributes:
            Object.keys(nextAttributes).length > 0
              ? nextAttributes
              : item.attributes,
          children: [...existingChildren, ...appendedChildren],
        };
      }
      if (Array.isArray(item.children)) {
        return {
          ...item,
          children: updateTargetInList(item.children),
        };
      }
      return item;
    });
  }

  return updateTargetInList(treeWithoutDonors);
}

// ── Теги SVG и иконок, которые вообще не трогаем ──
const IGNORED_SVG_TAGS = new Set([
  "i",
  "svg",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "g",
  "defs",
  "clippath",
  "mask",
  "pattern",
  "lineargradient",
  "radialgradient",
  "stop",
  "text",
  "tspan",
  "use",
  "symbol",
  "marker",
  "animate",
  "animatetransform",
  "fegaussianblur",
  "femerge",
  "femergenode",
  "fecolormatrix",
  "fecomposite",
  "feblend",
  "feoffset",
  "fedropshadow",
]);

/**
 * 🔹 Проверка на утилитарные классы шрифтов/отступов/цветов из Figma
 */
function isUtilityOrFontClass(cls: string): boolean {
  const lower = cls.toLowerCase();
  return (
    lower.startsWith("font-") ||
    lower.startsWith("text-") ||
    lower.startsWith("bg-") ||
    lower.startsWith("border-") ||
    lower.startsWith("p-") ||
    lower.startsWith("m-") ||
    lower.startsWith("w-") ||
    lower.startsWith("h-") ||
    lower.startsWith("flex") ||
    lower.startsWith("grid") ||
    lower.includes(":") ||
    lower === "container" ||
    lower === "is" ||
    lower === "svg-wrapper" ||
    lower.includes("__")
  );
}

/**
 * 🔹 Извлекает чистое смысловое имя блока (например "card", "services", "section-frame-32")
 */
function getSemanticBlockName(node: HtmlNode): string {
  const rawClasses = (node.class || "").trim().split(/\s+/).filter(Boolean);
  const semanticClass = rawClasses.find((cls) => !isUtilityOrFontClass(cls));

  if (semanticClass) {
    return semanticClass;
  }

  const tag = (node.tag || "div").toLowerCase();
  return tag !== "div" ? tag : "block";
}

const SECTION_WRAPPER_NAMES = [
  "prim",
  "sec",
  "tert",
  "quat",
  "quin",
  "sext",
  "sept",
  "oct",
  "non",
  "dec",
];

const DIV_DEPTH_NAMES = ["inner", "box", "group", "sub"];

function getOrdinalWrapperSuffix(index: number): string {
  return SECTION_WRAPPER_NAMES[index] || `part-${index + 1}`;
}

function getDivDepthName(depth: number): string {
  return DIV_DEPTH_NAMES[depth] || `lvl-${depth + 1}`;
}

function getNodeClasses(node: HtmlNode): string[] {
  return (node.class || "").trim().split(/\s+/).filter(Boolean);
}

function hasNodeClass(node: HtmlNode, targetClass: string): boolean {
  return getNodeClasses(node).includes(targetClass);
}

function resolveBlockAndModifier(node: HtmlNode): {
  blockName: string;
  baseModifier: string;
} {
  const rawClasses = getNodeClasses(node);
  const semanticClass = rawClasses.find((cls) => !isUtilityOrFontClass(cls));

  if (semanticClass) {
    return { blockName: semanticClass, baseModifier: "" };
  }

  // Если выбрали уже размеченный БЭМ-узел (например `bunner__prim` или `bunner__inner-sec`)
  const bemClass = rawClasses.find((cls) => cls.includes("__"));
  if (bemClass) {
    const [blockPart, elemPart = ""] = bemClass.split("__");
    const modMatch = new RegExp(
      `(?:^|-)(${SECTION_WRAPPER_NAMES.join("|")}|part-\\d+)$`,
    ).exec(elemPart);
    if (blockPart) {
      return {
        blockName: blockPart,
        baseModifier: modMatch ? modMatch[1] : "",
      };
    }
  }

  const tag = (node.tag || "div").toLowerCase();
  return {
    blockName: tag !== "div" ? tag : "block",
    baseModifier: "",
  };
}

function isWrapperDiv(node: HtmlNode): boolean {
  const tag = (node.tag || "div").toLowerCase();
  if (tag !== "div") return false;
  if (
    hasNodeClass(node, "container") ||
    hasNodeClass(node, "is") ||
    hasNodeClass(node, "svg-wrapper")
  ) {
    return false;
  }
  return Array.isArray(node.children) && node.children.length > 0;
}

function appendBemClass(
  existingClasses: string[],
  generatedClass: string,
): string {
  if (!generatedClass) return existingClasses.join(" ");
  const updated = new Set(existingClasses);
  updated.add(generatedClass);
  return Array.from(updated).join(" ");
}

function joinBemParts(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join("-");
}

/**
 * Подсчитывает количество не-служебных div по глубине внутри текущей области,
 * не заходя внутрь <li> (у каждого <li> свой локальный подсчёт).
 */
function countDivsByDepth(
  nodes: HtmlNode[],
  depth = 0,
  counts: Map<number, number> = new Map(),
): Map<number, number> {
  for (const node of nodes) {
    if (hasNodeClass(node, "is")) continue;

    const tag = (node.tag || "div").toLowerCase();
    if (IGNORED_SVG_TAGS.has(tag)) continue;
    if (tag === "li") continue;

    let nextDepth = depth;
    if (tag === "div") {
      if (hasNodeClass(node, "svg-wrapper")) continue;
      if (!hasNodeClass(node, "container")) {
        counts.set(depth, (counts.get(depth) || 0) + 1);
        nextDepth = depth + 1;
      }
    }

    if (Array.isArray(node.children)) {
      countDivsByDepth(node.children, nextDepth, counts);
    }
  }
  return counts;
}

/**
 * 🔹 Контекстное автоформирование БЭМ-классов для любого родительского блока:
 * 1. Узлы с классом `is` и всё их содержимое (включая <img>) пропускаются как есть.
 * 2. Узлы с классом `svg-wrapper` помечаются контекстно (`red__svg-prim`, `red__item-svg-prim`, `red__link-svg-wrapper-prim`).
 * 3. Остальные теги из IGNORED_SVG_TAGS (<i> без svg-wrapper, <svg>, <path>...) игнорируются.
 * 4. Работает на любом родителе (`section`, `header`, `footer`, `div`, `ul`, и т.д. — в т.ч. на уже размеченных БЭМ-обёртках).
 * 5. После .container (или сразу внутри родителя):
 *    - общий div для ≥ 2 обёрток → `red__wrap`
 *    - обёртки по порядку → `red__prim`, `red__sec`, `red__tert`, `red__quat`, ...
 * 6. Контекстная специфичность вложенных нод:
 *    - на одном уровне в родителе однотипные теги остаются одинаковыми (`red__p-prim`, `red__p-prim`)
 *    - внутри h1..h6 / p / button / a: `red__title-span-prim`, `red__p-span-prim`, `red__button-span-prim`, `red__link-span-prim`
 *    - внутри `li`: префикс `item-` (`red__item-svg-prim`, `red__item-inner-prim`, `red__item-title_h4-prim`, `red__item-p-prim`...)
 *    - внутри обычных вложенных div (`inner`, `box`, `group`): префикс своей обёртки (`red__inner-p-prim`, `red__box-p-prim`...)
 */
export function applyBemClassesToSection(
  tree: HtmlNode[],
  targetKey?: string | null,
): HtmlNode[] {
  if (!tree || tree.length === 0) return tree;

  // 1. Находим целевого родителя по ключу, иначе берём первый корневой узел
  let rootNode: HtmlNode | null = null;
  if (targetKey) {
    rootNode = findNodeInTree(tree, targetKey);
  }

  if (!rootNode) {
    rootNode = tree[0];
  }

  if (!rootNode) return tree;

  const rootKey = getNodeKey(rootNode);
  const { blockName: rootBlockName, baseModifier } =
    resolveBlockAndModifier(rootNode);

  // 2. Рекурсивная обработка элементов внутри области (обёртки или <li>)
  function processScopeElements(
    nodes: HtmlNode[],
    modifier: string,
    initialScopePrefix = "",
    inListItem = false,
  ): HtmlNode[] {
    const totalByDepth = countDivsByDepth(nodes, 0);
    const seenByDepth = new Map<number, number>();
    const mod = modifier ? `-${modifier}` : "";

    function walkElement(
      node: HtmlNode,
      divDepth: number,
      scopePrefix: string,
      inlineContext: "" | "title" | "p" | "button" | "link",
    ): HtmlNode {
      // ⛔ Служебный класс `is` — пропускаем ноду и всё содержимое как есть
      if (hasNodeClass(node, "is")) {
        return node;
      }

      const tag = (node.tag || "div").toLowerCase();
      const existingClasses = getNodeClasses(node);
      const isSvgWrapper = existingClasses.includes("svg-wrapper");

      // ⛔ Игнорируем иконки и SVG (кроме .svg-wrapper)
      if (!isSvgWrapper && IGNORED_SVG_TAGS.has(tag)) {
        return node;
      }

      let generatedClass = "";
      let nextDivDepth = divDepth;
      let nextScopePrefix = scopePrefix;
      let nextInlineContext = inlineContext;

      if (isSvgWrapper) {
        generatedClass =
          inlineContext === "link"
            ? `${rootBlockName}__${joinBemParts(scopePrefix, "link-svg-wrapper")}${mod}`
            : `${rootBlockName}__${joinBemParts(scopePrefix, "svg")}${mod}`;
      } else if (tag === "ul") {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, "items")}${mod}`;
        nextInlineContext = "";
      } else if (tag === "li") {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, "item")}${mod}`;
        return {
          ...node,
          class: appendBemClass(existingClasses, generatedClass),
          children: Array.isArray(node.children)
            ? processScopeElements(node.children, modifier, "item", true)
            : node.children,
        };
      } else if (tag === "a") {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, "link")}${mod}`;
        nextInlineContext = "link";
      } else if (inlineContext && tag !== "div") {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, inlineContext, tag)}${mod}`;
      } else if (tag === "p") {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, "p")}${mod}`;
        nextInlineContext = "p";
      } else if (tag === "span") {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, "span")}${mod}`;
      } else if (/^h[1-6]$/.test(tag)) {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, `title_${tag}`)}${mod}`;
        nextInlineContext = "title";
      } else if (tag === "button") {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, "button")}${mod}`;
        nextInlineContext = "button";
      } else if (tag === "img") {
        generatedClass = `${rootBlockName}__${joinBemParts(scopePrefix, "img")}${mod}`;
      } else if (tag === "div") {
        const isContainer = existingClasses.includes("container");
        if (!isContainer) {
          const currentIdx = (seenByDepth.get(divDepth) || 0) + 1;
          seenByDepth.set(divDepth, currentIdx);
          nextDivDepth = divDepth + 1;

          const totalAtDepth = totalByDepth.get(divDepth) || 1;
          const depthName = getDivDepthName(divDepth);
          const indexPart = totalAtDepth > 1 ? `-${currentIdx}` : "";
          const divName = `${depthName}${indexPart}`;

          const divElementName = inListItem
            ? joinBemParts("item", divName)
            : divName;

          nextScopePrefix = inListItem
            ? divDepth === 0
              ? "item"
              : divElementName
            : divName;

          const alreadyHasBem = existingClasses.some(
            (cls) =>
              cls === `${rootBlockName}__` ||
              cls.startsWith(`${rootBlockName}__`),
          );

          if (!alreadyHasBem) {
            generatedClass = `${rootBlockName}__${divElementName}${mod}`;
          }
        }
      }

      return {
        ...node,
        class: appendBemClass(existingClasses, generatedClass),
        children: Array.isArray(node.children)
          ? node.children.map((c) =>
              walkElement(c, nextDivDepth, nextScopePrefix, nextInlineContext),
            )
          : node.children,
      };
    }

    return nodes.map((n) => walkElement(n, 0, initialScopePrefix, ""));
  }

  function processSingleNonWrapper(node: HtmlNode, modifier: string): HtmlNode {
    return processScopeElements([node], modifier)[0];
  }

  // 3. Обработка уровня с обёртками (prim, sec, tert...)
  function processBlocksLevel(children: HtmlNode[]): HtmlNode[] {
    let blockIndex = 0;

    return children.map((child) => {
      if (hasNodeClass(child, "is")) {
        return child;
      }

      if (isWrapperDiv(child)) {
        const suffix = getOrdinalWrapperSuffix(blockIndex++);
        const existingClasses = getNodeClasses(child);
        const wrapperClass = `${rootBlockName}__${suffix}`;

        return {
          ...child,
          class: appendBemClass(existingClasses, wrapperClass),
          children: Array.isArray(child.children)
            ? processScopeElements(child.children, suffix)
            : child.children,
        };
      }

      return processSingleNonWrapper(child, "");
    });
  }

  // 4. Обработка содержимого layout-контейнера (.container или самого родителя)
  function processLayoutScope(children: HtmlNode[]): HtmlNode[] {
    const topWrapperDivs = children.filter(isWrapperDiv);

    if (topWrapperDivs.length === 1) {
      const singleDiv = topWrapperDivs[0];
      const innerWrapperDivs = (singleDiv.children || []).filter(isWrapperDiv);

      // Если один общий div оборачивает несколько блоков → он становится __wrap
      if (innerWrapperDivs.length >= 2) {
        const singleDivKey = getNodeKey(singleDiv);

        return children.map((child) => {
          if (hasNodeClass(child, "is")) {
            return child;
          }

          if (getNodeKey(child) === singleDivKey) {
            const existingClasses = getNodeClasses(child);

            return {
              ...child,
              class: appendBemClass(existingClasses, `${rootBlockName}__wrap`),
              children: processBlocksLevel(child.children || []),
            };
          }
          return processSingleNonWrapper(child, "");
        });
      }
    }

    // Если в контейнере сразу несколько обёрток (или один блок без внутренних обёрток)
    if (topWrapperDivs.length >= 1) {
      return processBlocksLevel(children);
    }

    return processScopeElements(children, "");
  }

  // 5. Обработка прямых детей родителя (учитывая наличие .container)
  function processSectionChildren(children: HtmlNode[]): HtmlNode[] {
    const containerNode = children.find((child) => {
      if (hasNodeClass(child, "is")) return false;
      const tag = (child.tag || "div").toLowerCase();
      if (tag !== "div") return false;
      return hasNodeClass(child, "container");
    });

    if (containerNode) {
      const containerKey = getNodeKey(containerNode);
      return children.map((child) => {
        if (hasNodeClass(child, "is")) {
          return child;
        }
        if (getNodeKey(child) === containerKey) {
          return {
            ...child,
            children: Array.isArray(child.children)
              ? processLayoutScope(child.children)
              : child.children,
          };
        }
        return processSingleNonWrapper(child, "");
      });
    }

    return processLayoutScope(children);
  }

  // 6. Обновляем целевой родительский узел в дереве
  function updateTree(list: HtmlNode[]): HtmlNode[] {
    return list.map((item) => {
      if (getNodeKey(item) === rootKey) {
        if (hasNodeClass(item, "is")) {
          return item;
        }
        return {
          ...item,
          children: Array.isArray(item.children)
            ? baseModifier
              ? processScopeElements(item.children, baseModifier)
              : processSectionChildren(item.children)
            : item.children,
        };
      }
      if (Array.isArray(item.children)) {
        return {
          ...item,
          children: updateTree(item.children),
        };
      }
      return item;
    });
  }

  return updateTree(tree);
}

// ============================================================================
// ШАБЛОНИЗАТОР / ПАКЕТНОЕ НАПОЛНЕНИЕ ДОНОРАМИ
// ============================================================================

/**
 * Сортирует список переданных ключей в соответствии с их физическим порядком появления в DOM-дереве.
 */
export function sortKeysByTreeOrder(
  tree: HtmlNode[],
  keys: Set<string> | string[],
): string[] {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  const ordered: string[] = [];

  function traverse(nodes: HtmlNode[]) {
    for (const node of nodes) {
      const k = getNodeKey(node);
      if (k && keySet.has(k)) {
        ordered.push(k);
      }
      if (Array.isArray(node.children)) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return ordered;
}

/**
 * Глубоко клонирует шаблон узла, присваивая элементам новые уникальные ключи
 * и записывая соответствие старых ключей новым в Map.
 */
export function cloneTemplateWithKeyMapping(
  node: HtmlNode,
  keyMap: Map<string, string>,
): HtmlNode {
  const oldKey = getNodeKey(node);
  const newKey = generateNodeKey();
  if (oldKey) {
    keyMap.set(oldKey, newKey);
  }

  return {
    ...node,
    _key: newKey,
    children: Array.isArray(node.children)
      ? node.children.map((child) => cloneTemplateWithKeyMapping(child, keyMap))
      : node.children,
  };
}

/**
 * Находит узел по ключу в дереве и применяет к нему функцию-мутатор (обновление).
 */
export function mutateNodeInTree(
  nodes: HtmlNode[],
  targetKey: string,
  updater: (node: HtmlNode) => HtmlNode,
): HtmlNode[] {
  return nodes.map((node) => {
    if (getNodeKey(node) === targetKey) {
      return updater(node);
    }
    if (Array.isArray(node.children)) {
      return {
        ...node,
        children: mutateNodeInTree(node.children, targetKey, updater),
      };
    }
    return node;
  });
}

/**
 * Переносит контент, классы, стили и атрибуты из узла-донора в узел-слот шаблона.
 */
export function applyDonorToSlot(
  slotNode: HtmlNode,
  donorNode: HtmlNode,
): HtmlNode {
  // 🎯 ЕСЛИ У СЛОТА ТЕГ ПУСТОЙ ("", null, undefined) — ОН ЗАБИРАЕТ ТЕГ ДОНОРА!
  const nextTag =
    slotNode.tag && slotNode.tag.trim() ? slotNode.tag : donorNode.tag || "div";

  let nextText = slotNode.text;
  if (typeof donorNode.text === "string" && donorNode.text.trim() !== "") {
    nextText = donorNode.text;
  }

  const classes = new Set<string>(
    (slotNode.class || "").trim().split(/\s+/).filter(Boolean),
  );
  if (donorNode.class) {
    donorNode.class
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((c) => classes.add(c));
  }
  const nextClass = Array.from(classes).join(" ");

  const nextAttributes: Record<string, string> = {
    ...(slotNode.attributes || {}),
  };
  if (donorNode.attributes && typeof donorNode.attributes === "object") {
    Object.assign(nextAttributes, donorNode.attributes);
  }

  let nextChildren = slotNode.children;
  if (
    (!slotNode.children || slotNode.children.length === 0) &&
    Array.isArray(donorNode.children) &&
    donorNode.children.length > 0
  ) {
    const childMap = new Map<string, string>();
    nextChildren = donorNode.children.map((c) =>
      cloneTemplateWithKeyMapping(c, childMap),
    );
  }

  return {
    ...slotNode,
    tag: nextTag, // 👈 Тег обновлен от донора, если был пустым!
    text: nextText,
    class: nextClass,
    attributes: nextAttributes,
    style: donorNode.style || slotNode.style,
    children: nextChildren,
  };
}

export interface TemplateFillResult {
  nextTree: HtmlNode[];
  usedCount: number;
  excessCount: number;
  warning?: string;
}

/**
 * 🔹 Заполнение одиночного шаблона донорами:
 * 1. Берет корневые элементы шаблона из правой панели.
 * 2. Берет узлы-доноры, отсортированные в порядке DOM-дерева.
 * 3. Использует доноров в количестве, не превышающем число слотов. Лишние доноры не затрагиваются!
 * 4. Клонирует шаблон с новыми ключами и переносит свойства доноров в соответствующие слоты.
 * 5. Удаляет использованных доноров из дерева.
 * 6. Добавляет заполненный клон в конец дерева (Панель 1).
 */
export function fillTemplateWithDonors(
  tree: HtmlNode[],
  rightKeys: Set<string>,
  slotKeys: string[],
  rawDonorKeys: string[],
): TemplateFillResult | null {
  if (
    !tree ||
    tree.length === 0 ||
    rightKeys.size === 0 ||
    slotKeys.length === 0
  ) {
    return null;
  }

  const templateRoots = extractNodesByKeys(tree, rightKeys);
  if (templateRoots.length === 0) return null;

  const validDonorKeys = rawDonorKeys.filter((k) => !rightKeys.has(k));
  if (validDonorKeys.length === 0) return null;

  const orderedDonors = sortKeysByTreeOrder(tree, validDonorKeys);
  if (orderedDonors.length === 0) return null;

  const slotsCount = slotKeys.length;
  const donorsToUse = orderedDonors.slice(0, slotsCount);
  const excessCount = Math.max(0, orderedDonors.length - slotsCount);

  const keyMap = new Map<string, string>();
  let clonedRoots = templateRoots.map((root) =>
    cloneTemplateWithKeyMapping(root, keyMap),
  );

  const usedDonorSet = new Set<string>();
  donorsToUse.forEach((donorKey, idx) => {
    usedDonorSet.add(donorKey);
    const origSlotKey = slotKeys[idx];
    const clonedSlotKey = keyMap.get(origSlotKey);
    if (!clonedSlotKey) return;

    const donorNode = findNodeInTree(tree, donorKey);
    if (!donorNode) return;

    clonedRoots = mutateNodeInTree(clonedRoots, clonedSlotKey, (target) =>
      applyDonorToSlot(target, donorNode),
    );
  });

  const treeWithoutUsedDonors = removeNodesByKeys(tree, usedDonorSet);
  const nextTree = [...treeWithoutUsedDonors, ...clonedRoots];

  return {
    nextTree,
    usedCount: donorsToUse.length,
    excessCount,
    warning:
      excessCount > 0
        ? `Filled ${donorsToUse.length} slots. ${excessCount} excess donor(s) skipped.`
        : undefined,
  };
}

/**
 * 🔹 Заполняет один конкретный слот в правой панели (in-place, без клонирования)
 * данными выбранного донора с левой панели и удаляет донора из дерева.
 */
export function fillSingleSlotInPlace(
  tree: HtmlNode[],
  rightKeys: Set<string>,
  targetSlotKey: string,
  donorKey: string,
): {
  nextTree: HtmlNode[];
  addedRightKeys: string[];
} | null {
  if (!tree || tree.length === 0 || !targetSlotKey || !donorKey) {
    return null;
  }
  if (rightKeys.has(donorKey)) {
    return null;
  }

  const slotNode = findNodeInTree(tree, targetSlotKey);
  const donorNode = findNodeInTree(tree, donorKey);
  if (!slotNode || !donorNode) {
    return null;
  }

  if (
    isDescendant(donorNode, targetSlotKey) ||
    isDescendant(slotNode, donorKey)
  ) {
    return null;
  }

  const addedRightKeys: string[] = [];
  let nextSlotNode = applyDonorToSlot(slotNode, donorNode);

  // Если донор принес с собой новых детей, регистрируем их ключи для правой панели
  if (
    (!slotNode.children || slotNode.children.length === 0) &&
    Array.isArray(nextSlotNode.children) &&
    nextSlotNode.children.length > 0
  ) {
    for (const child of nextSlotNode.children) {
      addedRightKeys.push(...collectAllDescendantKeys(child));
    }
  }

  const updatedTree = mutateNodeInTree(tree, targetSlotKey, () => nextSlotNode);
  const nextTree = removeNodesByKeys(updatedTree, new Set([donorKey]));

  return {
    nextTree,
    addedRightKeys,
  };
}
