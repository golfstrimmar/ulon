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
// DELETE
// ============================================================================

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
