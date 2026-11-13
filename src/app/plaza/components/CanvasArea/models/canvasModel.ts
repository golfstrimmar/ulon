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

function isWrapperDiv(node: HtmlNode): boolean {
  const tag = (node.tag || "div").toLowerCase();
  if (tag !== "div") return false;
  const classes = (node.class || "").trim().split(/\s+/).filter(Boolean);
  if (classes.includes("container")) return false;
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

function countDivsByDepth(
  nodes: HtmlNode[],
  depth = 0,
  counts: Map<number, number> = new Map(),
): Map<number, number> {
  for (const node of nodes) {
    const tag = (node.tag || "div").toLowerCase();
    if (IGNORED_SVG_TAGS.has(tag)) continue;

    let nextDepth = depth;
    if (tag === "div") {
      const classes = (node.class || "").trim().split(/\s+/).filter(Boolean);
      if (!classes.includes("container")) {
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
 * 🔹 Структурное автоформирование БЭМ-классов для секции:
 * 1. Игнорирует <i>, <svg> и всё их содержимое.
 * 2. Корень блока (например "red") сохраняется для всей секции (без переключения на вложенные классы Figma).
 * 3. После .container (или сразу в секции, если .container нет):
 *    - Если один общий div оборачивает ≥ 2 дочерних блоков-обёрток → он получает `red__wrap`.
 *    - Дочерние обёртки (или если в контейнере сразу ≥ 2 обёрток без wrap) получают по порядку:
 *      `red__prim`, `red__sec`, `red__tert`, `red__quat`, `red__quin`, `red__sext`, `red__sept`, `red__oct`, `red__non`, `red__dec`.
 * 4. Все дочерние ноды внутри обёртки получают её модификатор в конец (`-prim`, `-sec`, `-tert`...):
 *    - ul         → red__items-sec
 *    - li         → red__item-sec
 *    - a          → red__link-sec
 *    - тег в a    → red__link-{tag}-sec (например red__link-span-sec)
 *    - p          → red__p-sec
 *    - span       → red__span-sec
 *    - h1..h6     → red__title_{tag}-sec
 *    - button     → red__button-sec
 *    - img        → red__img-sec
 *    - div (по глубине внутри обёртки):
 *        уровень 1 → red__inner-sec (или red__inner-1-sec, red__inner-2-sec)
 *        уровень 2 → red__box-sec   (или red__box-1-sec,   red__box-2-sec)
 *        уровень 3 → red__group-sec (или red__group-1-sec, red__group-2-sec)
 *        уровень 4 → red__sub-sec   (далее lvl-5...)
 */
export function applyBemClassesToSection(
  tree: HtmlNode[],
  targetKey?: string | null,
): HtmlNode[] {
  if (!tree || tree.length === 0) return tree;

  // 1. Находим целевую секцию или активную ноду
  let rootNode: HtmlNode | null = null;
  if (targetKey) {
    rootNode = findNodeInTree(tree, targetKey);
  }

  if (!rootNode) {
    function findSection(list: HtmlNode[]): HtmlNode | null {
      for (const item of list) {
        if ((item.tag || "").toLowerCase() === "section") return item;
        if (Array.isArray(item.children)) {
          const found = findSection(item.children);
          if (found) return found;
        }
      }
      return null;
    }
    rootNode = findSection(tree) || tree[0];
  }

  if (!rootNode) return tree;

  const rootKey = getNodeKey(rootNode);
  const rootBlockName = getSemanticBlockName(rootNode);

  // 2. Рекурсивная обработка элементов внутри области с общим счётчиком глубины div
  function processScopeElements(
    nodes: HtmlNode[],
    modifier: string,
  ): HtmlNode[] {
    const totalByDepth = countDivsByDepth(nodes, 0);
    const seenByDepth = new Map<number, number>();
    const mod = modifier ? `-${modifier}` : "";

    function walkElement(
      node: HtmlNode,
      divDepth: number,
      isInLink: boolean,
    ): HtmlNode {
      const tag = (node.tag || "div").toLowerCase();

      // ⛔ Игнорируем иконки и SVG целиком
      if (IGNORED_SVG_TAGS.has(tag)) {
        return node;
      }

      const existingClasses = (node.class || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      let generatedClass = "";
      let nextIsInLink = isInLink;
      let nextDivDepth = divDepth;

      if (tag === "ul") {
        generatedClass = `${rootBlockName}__items${mod}`;
        nextIsInLink = false;
      } else if (tag === "li") {
        generatedClass = `${rootBlockName}__item${mod}`;
        nextIsInLink = false;
      } else if (tag === "a") {
        generatedClass = `${rootBlockName}__link${mod}`;
        nextIsInLink = true;
      } else if (isInLink) {
        generatedClass = `${rootBlockName}__link-${tag}${mod}`;
      } else if (tag === "p") {
        generatedClass = `${rootBlockName}__p${mod}`;
      } else if (tag === "span") {
        generatedClass = `${rootBlockName}__span${mod}`;
      } else if (/^h[1-6]$/.test(tag)) {
        generatedClass = `${rootBlockName}__title_${tag}${mod}`;
      } else if (tag === "button") {
        generatedClass = `${rootBlockName}__button${mod}`;
      } else if (tag === "img") {
        generatedClass = `${rootBlockName}__img${mod}`;
      } else if (tag === "div") {
        const isContainer = existingClasses.includes("container");
        if (!isContainer) {
          const currentIdx = (seenByDepth.get(divDepth) || 0) + 1;
          seenByDepth.set(divDepth, currentIdx);
          nextDivDepth = divDepth + 1;

          const alreadyHasBem = existingClasses.some(
            (cls) =>
              cls === `${rootBlockName}__` ||
              cls.startsWith(`${rootBlockName}__`),
          );

          if (!alreadyHasBem) {
            const totalAtDepth = totalByDepth.get(divDepth) || 1;
            const depthName = getDivDepthName(divDepth);
            const indexPart = totalAtDepth > 1 ? `-${currentIdx}` : "";
            generatedClass = `${rootBlockName}__${depthName}${indexPart}${mod}`;
          }
        }
      }

      return {
        ...node,
        class: appendBemClass(existingClasses, generatedClass),
        children: Array.isArray(node.children)
          ? node.children.map((c) => walkElement(c, nextDivDepth, nextIsInLink))
          : node.children,
      };
    }

    return nodes.map((n) => walkElement(n, 0, false));
  }

  function processSingleNonWrapper(node: HtmlNode, modifier: string): HtmlNode {
    return processScopeElements([node], modifier)[0];
  }

  // 3. Обработка уровня с обёртками (prim, sec, tert...)
  function processBlocksLevel(children: HtmlNode[]): HtmlNode[] {
    let blockIndex = 0;

    return children.map((child) => {
      if (isWrapperDiv(child)) {
        const suffix = getOrdinalWrapperSuffix(blockIndex++);
        const existingClasses = (child.class || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
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

  // 4. Обработка содержимого layout-контейнера (.container или самой секции)
  function processLayoutScope(children: HtmlNode[]): HtmlNode[] {
    const topWrapperDivs = children.filter(isWrapperDiv);

    if (topWrapperDivs.length === 1) {
      const singleDiv = topWrapperDivs[0];
      const innerWrapperDivs = (singleDiv.children || []).filter(isWrapperDiv);

      // Если один общий div оборачивает несколько блоков → он становится __wrap
      if (innerWrapperDivs.length >= 2) {
        const singleDivKey = getNodeKey(singleDiv);

        return children.map((child) => {
          if (getNodeKey(child) === singleDivKey) {
            const existingClasses = (child.class || "")
              .trim()
              .split(/\s+/)
              .filter(Boolean);

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

  // 5. Обработка прямых детей секции (учитывая наличие .container)
  function processSectionChildren(children: HtmlNode[]): HtmlNode[] {
    const containerNode = children.find((child) => {
      const tag = (child.tag || "div").toLowerCase();
      if (tag !== "div") return false;
      const classes = (child.class || "").trim().split(/\s+/).filter(Boolean);
      return classes.includes("container");
    });

    if (containerNode) {
      const containerKey = getNodeKey(containerNode);
      return children.map((child) => {
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

  // 6. Обновляем корневую секцию в дереве
  function updateTree(list: HtmlNode[]): HtmlNode[] {
    return list.map((item) => {
      if (getNodeKey(item) === rootKey) {
        return {
          ...item,
          children: Array.isArray(item.children)
            ? processSectionChildren(item.children)
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
