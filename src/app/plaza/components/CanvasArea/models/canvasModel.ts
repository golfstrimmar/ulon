import type { HtmlNode } from "@/types/HtmlNode";
import {
  generateNodeKey,
  findNodeByKey,
  removeNodeFromTree,
  isDescendant,
  duplicateNodeInTree,
} from "@/lib/htmlTree";

export function sanitizeCssBody(css: string): string {
  return css.replace(/\}\s*;/g, "}").trim();
}

export const getNodeKey = (node: HtmlNode | null | undefined): string =>
  node?._key || (node as any)?.id || "";

/** Guarantees unique keys for all nodes */
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

/** Recursively collects keys of all container nodes */
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

/** Finds a node by criteria */
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

/** Recursively finds a node in the tree */
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

/** Collects node key and all descendant keys */
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

/** Removes specified keys from tree */
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

/** Extracts nodes by keys */
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

/** Extracts styles and scripts */
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

export function mergeScssWithoutDuplicates(
  currentScss: string,
  incomingScss: string,
): string {
  if (!incomingScss.trim()) return currentScss;
  if (!currentScss.trim()) return incomingScss.trim();

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
      }
    } else {
      if (!result.includes(rule)) {
        result = `${result.trim()}\n\n${rule}`;
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
  let currentTree = tree;
  for (const key of sourceKeys) {
    currentTree = duplicateNodeInTree(currentTree, key);
  }
  return currentTree;
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

export function applyBemClassesToSection(
  tree: HtmlNode[],
  targetKey?: string | null,
): HtmlNode[] {
  if (!tree || tree.length === 0) return tree;

  function getBemSuffix(tag: string): string {
    const t = tag.toLowerCase();
    if (/^h[1-6]$/.test(t)) return "title";
    if (t === "button") return "button";
    if (t === "img") return "img";
    if (t === "svg") return "svg";
    if (t === "a") return "link";
    return "";
  }

  let sectionNode: HtmlNode | null = null;
  if (targetKey) {
    const candidate = findNodeInTree(tree, targetKey);
    if (candidate && (candidate.tag || "").toLowerCase() === "section") {
      sectionNode = candidate;
    }
  }

  if (!sectionNode) {
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
    sectionNode = findSection(tree);
  }

  if (!sectionNode && tree.length > 0) {
    sectionNode = tree[0];
  }

  if (!sectionNode) return tree;

  const sectionKey = getNodeKey(sectionNode);
  const rawClasses = (sectionNode.class || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const blockName =
    rawClasses[0] ||
    (sectionNode.tag ? sectionNode.tag.toLowerCase() : "section");

  function processDescendants(
    children: HtmlNode[] | string,
  ): HtmlNode[] | string {
    if (!Array.isArray(children)) return children;
    return children.map((child) => {
      const updatedChild: HtmlNode = { ...child };
      const tag = (child.tag || "div").toLowerCase();
      const existingClasses = (child.class || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const isContainer =
        tag === "div" && existingClasses.includes("container");

      const alreadyHasBem =
        Boolean((child as any)._bemApplied) ||
        existingClasses.some(
          (cls) => cls === `${blockName}__` || cls.startsWith(`${blockName}__`),
        );

      if (!isContainer && !alreadyHasBem) {
        const suffix = getBemSuffix(tag);
        const bemClass = `${blockName}__${suffix}`;
        updatedChild.class = [...existingClasses, bemClass].join(" ");
        (updatedChild as any)._bemApplied = true;
      }

      if (Array.isArray(updatedChild.children)) {
        updatedChild.children = processDescendants(
          updatedChild.children,
        ) as HtmlNode[];
      }
      return updatedChild;
    });
  }

  function updateTree(list: HtmlNode[]): HtmlNode[] {
    return list.map((item) => {
      if (getNodeKey(item) === sectionKey) {
        return {
          ...item,
          children: processDescendants(item.children),
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
// TEMPLATE ENGINE / BATCH DONOR FILLING
// ============================================================================

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
 * 🔹 Single Template Population with Donors:
 * 1. Takes right pane template roots.
 * 2. Takes donor nodes sorted by DOM order.
 * 3. Uses donors up to the number of slots. Excess donors are untouched!
 * 4. Clones template with fresh keys and maps donor props to corresponding slots.
 * 5. Removes used donors from tree.
 * 6. Appends populated clone to the end of tree (Pane 1).
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
