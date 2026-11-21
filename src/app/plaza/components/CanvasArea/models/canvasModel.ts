import type { HtmlNode } from "@/types/HtmlNode";
import {
  generateNodeKey,
  findNodeByKey,
  removeNodeFromTree,
  isDescendant,
  duplicateNodeInTree,
} from "@/lib/htmlTree";

export const PLAZA_MARKER_ATTR = "data-plaza-marker";

export interface DonorItem {
  key: string;
  tag: string;
  text: string;
  className: string;
  imgSrc: string | null;
  isSvg: boolean;
  node: HtmlNode;
}

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
 * Проверяет, является ли узел маркером места вставки.
 */
export function isMarkerNode(node: HtmlNode | null | undefined): boolean {
  return Boolean(node?.attributes?.[PLAZA_MARKER_ATTR] === "true");
}

/**
 * Ищет ключ активного маркера в дереве.
 */
export function findMarkerKeyInTree(nodes: HtmlNode[]): string | null {
  if (!Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (isMarkerNode(node)) {
      return getNodeKey(node) || null;
    }
    if (Array.isArray(node.children)) {
      const found = findMarkerKeyInTree(node.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Создаёт новую ноду-маркер.
 */
export function createMarkerNode(): HtmlNode {
  return {
    tag: "div",
    text: "",
    class: "",
    style: "",
    attributes: { [PLAZA_MARKER_ATTR]: "true" },
    children: [],
    _key: `marker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
}

/**
 * Заменяет узел-маркер на новые ноды (либо оставляет маркер сразу после них при keepMarker = true).
 */
export function replaceMarkerWithNodes(
  nodes: HtmlNode[],
  markerKey: string,
  replacementNodes: HtmlNode[],
  keepMarker = false,
): { nextTree: HtmlNode[]; replaced: boolean } {
  let replaced = false;

  function walk(list: HtmlNode[]): HtmlNode[] {
    const nextList: HtmlNode[] = [];
    for (const node of list) {
      if (!replaced && getNodeKey(node) === markerKey) {
        replaced = true;
        nextList.push(...replacementNodes);
        if (keepMarker) {
          nextList.push(node);
        }
      } else if (Array.isArray(node.children)) {
        nextList.push({
          ...node,
          children: walk(node.children),
        });
      } else {
        nextList.push(node);
      }
    }
    return nextList;
  }

  const nextTree = walk(nodes);
  return { nextTree, replaced };
}

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
 * извлекает inline-стили и скрипты, проставляет уникальные ключи,
 * заменяет маркер (если он есть) и собирает ключи для правой панели при сплит-режиме.
 */
export function prepareAppendedNodes(
  currentTree: HtmlNode[],
  rawData: HtmlNode | HtmlNode[],
  isSplit: boolean,
  markerOptions?: {
    markerKey?: string | null;
    keepMarker?: boolean;
    markerInRightPane?: boolean;
  },
): {
  nextTree: HtmlNode[];
  extractedScss: string;
  extractedScripts: { name: string; code: string }[];
  addedRightKeys: string[];
  replacedMarkerKey: string | null;
} {
  const nodes: HtmlNode[] = Array.isArray(rawData) ? rawData : [rawData];
  const { cleanNodes, extractedScss, extractedScripts } =
    extractStylesAndScriptsFromNodes(nodes);

  const nodesWithUniqueKeys = ensureUniqueKeys(cleanNodes);

  let nextTree: HtmlNode[];
  let replacedMarkerKey: string | null = null;

  if (markerOptions?.markerKey) {
    const res = replaceMarkerWithNodes(
      currentTree,
      markerOptions.markerKey,
      nodesWithUniqueKeys,
      Boolean(markerOptions.keepMarker),
    );
    if (res.replaced) {
      nextTree = res.nextTree;
      replacedMarkerKey = markerOptions.markerKey;
    } else {
      nextTree = [...currentTree, ...nodesWithUniqueKeys];
    }
  } else {
    nextTree = [...currentTree, ...nodesWithUniqueKeys];
  }

  const shouldAddToRight = replacedMarkerKey
    ? Boolean(markerOptions?.markerInRightPane)
    : isSplit;

  const addedRightKeys: string[] = [];
  if (shouldAddToRight) {
    for (const node of nodesWithUniqueKeys) {
      addedRightKeys.push(...collectAllDescendantKeys(node));
    }
  }

  return {
    nextTree,
    extractedScss,
    extractedScripts,
    addedRightKeys,
    replacedMarkerKey,
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
 * Извлекает плоский список контентных доноров (ноды с текстом, <img> или <svg>)
 * без пустых контейнеров-обёрток и без внутренностей SVG.
 */
export function extractDonorNodes(nodes: HtmlNode[]): DonorItem[] {
  if (!Array.isArray(nodes)) return [];
  const items: DonorItem[] = [];

  function walk(list: HtmlNode[]) {
    for (const node of list) {
      const key = getNodeKey(node);
      const tag = (node.tag || "").trim().toLowerCase();
      const text = (node.text || "").trim();
      const imgSrc = tag === "img" ? node.attributes?.src || null : null;
      const isSvg = tag === "svg";

      if (key && (text || imgSrc || isSvg)) {
        items.push({
          key,
          tag: tag || "div",
          text,
          className: (node.class || "").trim(),
          imgSrc,
          isSvg,
          node,
        });
      }

      if (isSvg) continue;

      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return items;
}

/**
 * Определяет, является ли контейнер строчным (горизонтальным flex-рядом или grid-контейнером),
 * анализируя встроенные стили и CSS-классы.
 */
export function isRowContainer(node: HtmlNode): boolean {
  const rawClass = (node.class || "").toLowerCase();
  const rawStyle = (node.style || "").toLowerCase();

  if (rawStyle.includes("flex-direction: row")) {
    return true;
  }
  if (rawStyle.includes("flex-direction: column")) {
    return false;
  }

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
    const classList = (node.class || "").split(/\s+/).filter(Boolean);

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

      const targetClass = classList.find(
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

export function mergeScriptsWithoutDuplicates(
  currentBundle: string,
  incomingScripts: { name: string; code: string }[],
): string {
  if (!incomingScripts || incomingScripts.length === 0) return currentBundle;

  let result = (currentBundle || "").trim();

  for (const script of incomingScripts) {
    const name = script.name.trim();
    const cleanCode = script.code
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

export function duplicateNodesGroup(
  tree: HtmlNode[],
  sourceKeys: string[],
): HtmlNode[] {
  if (!tree || sourceKeys.length === 0) return tree;

  const orderedKeys = sortKeysByTreeOrder(tree, sourceKeys);
  if (orderedKeys.length === 0) return tree;

  const keyMap = new Map<string, string>();
  const clonedNodes: HtmlNode[] = [];

  for (const key of orderedKeys) {
    const orig = findNodeInTree(tree, key);
    if (orig) {
      clonedNodes.push(cloneTemplateWithKeyMapping(orig, keyMap));
    }
  }

  if (clonedNodes.length === 0) return tree;

  const anchorKey = orderedKeys[orderedKeys.length - 1];
  return insertNodesAdjacent(tree, anchorKey, clonedNodes, "after");
}

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

export function applyBemClassesToSection(
  tree: HtmlNode[],
  targetKey?: string | null,
): HtmlNode[] {
  if (!tree || tree.length === 0) return tree;

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
      if (hasNodeClass(node, "is")) {
        return node;
      }

      const tag = (node.tag || "div").toLowerCase();
      const existingClasses = getNodeClasses(node);
      const isSvgWrapper = existingClasses.includes("svg-wrapper");

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

  function processLayoutScope(children: HtmlNode[]): HtmlNode[] {
    const topWrapperDivs = children.filter(isWrapperDiv);

    if (topWrapperDivs.length === 1) {
      const singleDiv = topWrapperDivs[0];
      const innerWrapperDivs = (singleDiv.children || []).filter(isWrapperDiv);

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

    if (topWrapperDivs.length >= 1) {
      return processBlocksLevel(children);
    }

    return processScopeElements(children, "");
  }

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

export function applyDonorToSlot(
  slotNode: HtmlNode,
  donorNode: HtmlNode,
): HtmlNode {
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
    tag: nextTag,
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
  const nextSlotNode = applyDonorToSlot(slotNode, donorNode);

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

export function fillMultipleSlotsInPlace(
  tree: HtmlNode[],
  rightKeys: Set<string>,
  slotKeys: string[],
  rawDonorKeys: string[],
): {
  nextTree: HtmlNode[];
  filledCount: number;
  remainingSlotKeys: string[];
  addedRightKeys: string[];
  usedDonorKeys: string[];
  excessCount: number;
} | null {
  if (!tree || tree.length === 0 || slotKeys.length === 0) {
    return null;
  }

  const validDonorKeys = rawDonorKeys.filter((k) => !rightKeys.has(k));
  if (validDonorKeys.length === 0) return null;

  const orderedDonors = sortKeysByTreeOrder(tree, validDonorKeys);
  if (orderedDonors.length === 0) return null;

  const count = Math.min(slotKeys.length, orderedDonors.length);
  const excessCount = Math.max(0, orderedDonors.length - slotKeys.length);

  let currentTree = tree;
  const addedRightKeys: string[] = [];
  const usedDonorKeys: string[] = [];
  const filledSlotSet = new Set<string>();

  for (let i = 0; i < count; i++) {
    const targetSlotKey = slotKeys[i];
    const donorKey = orderedDonors[i];

    const slotNode = findNodeInTree(currentTree, targetSlotKey);
    const donorNode = findNodeInTree(currentTree, donorKey);
    if (!slotNode || !donorNode) continue;

    if (
      isDescendant(donorNode, targetSlotKey) ||
      isDescendant(slotNode, donorKey)
    ) {
      continue;
    }

    const nextSlotNode = applyDonorToSlot(slotNode, donorNode);

    if (
      (!slotNode.children || slotNode.children.length === 0) &&
      Array.isArray(nextSlotNode.children) &&
      nextSlotNode.children.length > 0
    ) {
      for (const child of nextSlotNode.children) {
        addedRightKeys.push(...collectAllDescendantKeys(child));
      }
    }

    currentTree = mutateNodeInTree(
      currentTree,
      targetSlotKey,
      () => nextSlotNode,
    );
    usedDonorKeys.push(donorKey);
    filledSlotSet.add(targetSlotKey);
  }

  if (usedDonorKeys.length === 0) return null;

  const nextTree = removeNodesByKeys(currentTree, new Set(usedDonorKeys));
  const remainingSlotKeys = slotKeys.filter((k) => !filledSlotSet.has(k));

  return {
    nextTree,
    filledCount: usedDonorKeys.length,
    remainingSlotKeys,
    addedRightKeys,
    usedDonorKeys,
    excessCount,
  };
}

// ============================================================================
// МОДЕЛЬ РАБОЧЕЙ ОБЛАСТИ (FLOATING-ОКНО, ЗУМ, СПЛИТ-ПАНЕЛИ)
// ============================================================================

export interface FloatingPos {
  x: number;
  y: number;
}

export interface FloatingSize {
  w: number;
  h: number;
}

export const MIN_GRAPH_ZOOM = 0.4;
export const MAX_GRAPH_ZOOM = 1.4;
export const MIN_FLOATING_WIDTH = 360;
export const MIN_FLOATING_HEIGHT = 220;

export function clampGraphZoom(zoom: number): number {
  return Number(
    Math.min(MAX_GRAPH_ZOOM, Math.max(MIN_GRAPH_ZOOM, zoom)).toFixed(2),
  );
}

export function getHeaderOffset(): number {
  if (typeof document === "undefined") return 56;
  const header = document.querySelector("header");
  if (!header) return 12;
  const rect = header.getBoundingClientRect();
  return Math.max(8, Math.round(rect.bottom + 8));
}

export function computeInitialFloatingBounds(
  viewportW: number,
  viewportH: number,
  isAsideFloating: boolean,
): { pos: FloatingPos; size: FloatingSize } {
  const headerTop = getHeaderOffset();
  const w = Math.min(760, Math.max(MIN_FLOATING_WIDTH, viewportW - 230));
  const h = Math.min(460, Math.max(240, viewportH - headerTop - 24));
  const x = isAsideFloating
    ? Math.min(208, Math.max(8, viewportW - w - 8))
    : Math.max(8, Math.round((viewportW - w) / 2));

  return {
    pos: { x, y: headerTop },
    size: { w, h },
  };
}

export function clampFloatingPosition(
  x: number,
  y: number,
  minTop: number,
  maxX: number,
  maxY: number,
): FloatingPos {
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(minTop, y)),
  };
}

export function clampFloatingSize(
  w: number,
  h: number,
  maxW: number,
  maxH: number,
): FloatingSize {
  return {
    w: Math.min(maxW, Math.max(MIN_FLOATING_WIDTH, w)),
    h: Math.min(maxH, Math.max(MIN_FLOATING_HEIGHT, h)),
  };
}

export function isPointInsideElement(
  el: HTMLElement | null,
  clientX: number,
  clientY: number,
): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return (
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom
  );
}

export function splitWorkspaceNodes(
  currentJson: HtmlNode[],
  rightKeys: Set<string>,
  isSplit: boolean,
): { leftNodes: HtmlNode[]; rightNodes: HtmlNode[] } {
  if (!isSplit || rightKeys.size === 0) {
    return { leftNodes: currentJson, rightNodes: [] };
  }
  return {
    leftNodes: removeNodesByKeys(currentJson, rightKeys),
    rightNodes: extractNodesByKeys(currentJson, rightKeys),
  };
}
