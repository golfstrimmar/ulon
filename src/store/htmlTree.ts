/**
 * @file htmlTree.ts
 * @description CRUD-операции над деревом узлов HtmlNode.
 * Все операции иммутабельны (возвращают новый объект дерева узлов).
 */

import { HtmlNode } from "@/types/htmlJson";

/**
 * Генерация уникального ключа узла
 */
export function generateNodeKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return "node_" + crypto.randomUUID().slice(0, 8);
  }
  return "node_" + Math.random().toString(36).slice(2, 10);
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Создает новый узел HtmlNode
 */
export function createNode(params?: Partial<HtmlNode>): HtmlNode {
  return {
    tag: params?.tag || "div",
    text: params?.text || "",
    class: params?.class || "",
    style: params?.style || "",
    attributes: params?.attributes || {},
    _key: params?._key || generateNodeKey(),
    _isNew: params?._isNew ?? true,
    children: params?.children ?? [],
  };
}

/**
 * Добавляет дочерний узел child в узел с ключом parentKey
 */
export function addChildNode(
  root: HtmlNode,
  parentKey: string,
  child: HtmlNode
): HtmlNode {
  const childWithKey: HtmlNode = {
    ...child,
    _key: child._key || generateNodeKey(),
  };

  if (root._key === parentKey) {
    const existing = Array.isArray(root.children) ? root.children : [];
    return {
      ...root,
      children: [...existing, childWithKey],
    };
  }

  if (!Array.isArray(root.children)) {
    return root;
  }

  return {
    ...root,
    children: root.children.map((current) =>
      addChildNode(current, parentKey, childWithKey)
    ),
  };
}

// ============================================================================
// READ
// ============================================================================

/**
 * Поиск узла в дереве по _key
 */
export function findNodeByKey(root: HtmlNode, key: string): HtmlNode | null {
  if (root._key === key) return root;

  if (Array.isArray(root.children)) {
    for (const child of root.children) {
      const found = findNodeByKey(child, key);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Сериализация дерева HtmlNode в чистую HTML-строку
 */
export function treeToHtml(node: HtmlNode, indent = 0): string {
  const pad = "  ".repeat(indent);
  const tag = (node.tag || "div").toLowerCase();

  const attrs: string[] = [];
  if (node._key) {
    attrs.push(`data-node-key="${node._key}"`);
  }
  if (node.class && node.class.trim()) {
    attrs.push(`class="${node.class.trim()}"`);
  }
  if (node.style && node.style.trim()) {
    attrs.push(`style="${node.style.trim()}"`);
  }
  if (node.attributes) {
    for (const [k, v] of Object.entries(node.attributes)) {
      if (v !== undefined && v !== null) {
        attrs.push(`${k}="${String(v)}"`);
      }
    }
  }

  const attrsStr = attrs.length > 0 ? " " + attrs.join(" ") : "";

  const voidTags = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
  ]);

  if (voidTags.has(tag)) {
    return `${pad}<${tag}${attrsStr} />`;
  }

  if (typeof node.children === "string") {
    const content = node.children || node.text || "";
    return `${pad}<${tag}${attrsStr}>${content}</${tag}>`;
  }

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const hasText = Boolean(node.text && node.text.trim());

  if (!hasChildren && !hasText) {
    return `${pad}<${tag}${attrsStr}></${tag}>`;
  }

  if (!hasChildren && hasText) {
    return `${pad}<${tag}${attrsStr}>${node.text || ""}</${tag}>`;
  }

  const inner = (node.children as HtmlNode[])
    .map((c) => treeToHtml(c, indent + 1))
    .join("\n");

  const textPrefix = hasText ? `${pad}  ${node.text}\n` : "";
  return `${pad}<${tag}${attrsStr}>\n${textPrefix}${inner}\n${pad}</${tag}>`;
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Обновляет узел с заданным _key новыми свойствами
 */
export function updateNodeByKey(
  root: HtmlNode,
  targetKey: string,
  patch: Partial<Omit<HtmlNode, "_key">>
): HtmlNode {
  if (root._key === targetKey) {
    return {
      ...root,
      ...patch,
      _key: root._key,
    };
  }

  if (!Array.isArray(root.children)) {
    return root;
  }

  return {
    ...root,
    children: root.children.map((child) =>
      updateNodeByKey(child, targetKey, patch)
    ),
  };
}

// ============================================================================
// MOVE / DUPLICATE / DRAG & DROP
// ============================================================================

/**
 * Создает глубокую копию узла с новыми уникальными _key для всей ветки
 */
export function cloneNodeWithNewKeys(node: HtmlNode): HtmlNode {
  return {
    ...node,
    _key: generateNodeKey(),
    children: Array.isArray(node.children)
      ? node.children.map(cloneNodeWithNewKeys)
      : node.children,
  };
}

/**
 * Дублирует узел с targetKey, вставляя копию сразу после оригинала
 */
export function duplicateNodeInTree(
  nodes: HtmlNode[],
  targetKey: string
): HtmlNode[] {
  const result: HtmlNode[] = [];

  for (const node of nodes) {
    if (node._key === targetKey) {
      result.push(node);
      result.push(cloneNodeWithNewKeys(node));
    } else {
      if (Array.isArray(node.children)) {
        result.push({
          ...node,
          children: duplicateNodeInTree(node.children, targetKey),
        });
      } else {
        result.push(node);
      }
    }
  }

  return result;
}

/**
 * Удаляет узел с targetKey из массива узлов (на любом уровне вложенности)
 */
export function deleteNodeFromArray(
  nodes: HtmlNode[],
  targetKey: string
): HtmlNode[] {
  const result: HtmlNode[] = [];
  for (const node of nodes) {
    if (node._key === targetKey) {
      continue;
    }
    if (Array.isArray(node.children)) {
      result.push({
        ...node,
        children: deleteNodeFromArray(node.children, targetKey),
      });
    } else {
      result.push(node);
    }
  }
  return result;
}

/**
 * Проверяет, является ли targetKey потомком узла parent
 */
export function isDescendant(parent: HtmlNode, targetKey: string): boolean {
  if (parent._key === targetKey) return true;
  if (Array.isArray(parent.children)) {
    for (const child of parent.children) {
      if (isDescendant(child, targetKey)) return true;
    }
  }
  return false;
}

/**
 * Удаляет узел из дерева (поиском по всему дереву) и возвращает удаленный узел
 */
export function removeNodeFromTree(
  nodes: HtmlNode[],
  targetKey: string
): { updatedNodes: HtmlNode[]; removedNode: HtmlNode | null } {
  let removed: HtmlNode | null = null;

  function filterNodes(list: HtmlNode[]): HtmlNode[] {
    const result: HtmlNode[] = [];
    for (const node of list) {
      if (node._key === targetKey) {
        removed = node;
        continue;
      }
      if (Array.isArray(node.children)) {
        result.push({
          ...node,
          children: filterNodes(node.children),
        });
      } else {
        result.push(node);
      }
    }
    return result;
  }

  const updatedNodes = filterNodes(nodes);
  return { updatedNodes, removedNode: removed };
}

/**
 * Вставляет узел в массив children целевого узла
 */
export function insertNodeIntoTarget(
  nodes: HtmlNode[],
  targetKey: string,
  nodeToInsert: HtmlNode
): HtmlNode[] {
  return nodes.map((node) => {
    if (node._key === targetKey) {
      let existingChildren: HtmlNode[] = [];
      if (Array.isArray(node.children)) {
        existingChildren = node.children;
      } else if (typeof node.children === "string" && node.children.trim()) {
        node = { ...node, text: node.text || node.children };
      }
      return {
        ...node,
        children: [...existingChildren, nodeToInsert],
      };
    }
    if (Array.isArray(node.children)) {
      return {
        ...node,
        children: insertNodeIntoTarget(node.children, targetKey, nodeToInsert),
      };
    }
    return node;
  });
}

/**
 * Вставляет узел смежно с целевым узлом (перед или после)
 */
export function insertAdjacentToTarget(
  nodes: HtmlNode[],
  targetKey: string,
  nodeToInsert: HtmlNode,
  position: "before" | "after"
): HtmlNode[] {
  const result: HtmlNode[] = [];
  for (const node of nodes) {
    if (node._key === targetKey) {
      if (position === "before") {
        result.push(nodeToInsert);
        result.push(node);
      } else {
        result.push(node);
        result.push(nodeToInsert);
      }
    } else {
      if (Array.isArray(node.children)) {
        result.push({
          ...node,
          children: insertAdjacentToTarget(node.children, targetKey, nodeToInsert, position),
        });
      } else {
        result.push(node);
      }
    }
  }
  return result;
}

/**
 * Перемещает узел sourceKey в позицию before / after / inside относительно targetKey
 */
export function moveNodePosition(
  nodes: HtmlNode[],
  sourceKey: string,
  targetKey: string,
  position: "before" | "after" | "inside"
): HtmlNode[] {
  if (sourceKey === targetKey) return nodes;

  // 1. Проверяем, что targetKey не потомок sourceKey
  let sourceNode: HtmlNode | null = null;
  for (const root of nodes) {
    const found = findNodeByKey(root, sourceKey);
    if (found) {
      sourceNode = found;
      break;
    }
  }
  if (!sourceNode || isDescendant(sourceNode, targetKey)) {
    return nodes;
  }

  // 2. Извлекаем sourceKey из дерева
  const { updatedNodes, removedNode } = removeNodeFromTree(nodes, sourceKey);
  if (!removedNode) return nodes;

  // 3. Вставляем в зависимости от позиции
  if (position === "inside") {
    return insertNodeIntoTarget(updatedNodes, targetKey, removedNode);
  } else {
    return insertAdjacentToTarget(updatedNodes, targetKey, removedNode, position);
  }
}

/**
 * Перемещает узел sourceKey вместе со всеми его потомками внутрь targetKey
 */
export function moveNodeIntoNode(
  nodes: HtmlNode[],
  sourceKey: string,
  targetKey: string
): HtmlNode[] {
  return moveNodePosition(nodes, sourceKey, targetKey, "inside");
}


/**
 * Удаляет узел с заданным _key из дерева.
 * Если передан ключ самого корня, возвращает null.
 */
export function deleteNodeByKey(
  root: HtmlNode,
  targetKey: string
): HtmlNode | null {
  if (root._key === targetKey) {
    return null;
  }

  if (!Array.isArray(root.children)) {
    return root;
  }

  return {
    ...root,
    children: root.children
      .filter((child) => child._key !== targetKey)
      .map((child) => deleteNodeByKey(child, targetKey) as HtmlNode)
      .filter(Boolean),
  };
}
