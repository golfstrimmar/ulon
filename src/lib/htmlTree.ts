/**
 * @file htmlTree.ts
 * @description Библиотека операций CRUD над деревом узлов HtmlNode.
 * Все мутации выполняются иммутабельно (возвращают новый объект дерева),
 * что идеально подходит для реактивного состояния React и предсказуемости данных.
 */

import { HtmlNode } from "@/types/htmlJson";

/**
 * Генерация уникального ключа для узла (UUID v4 с фоллбэком)
 */
export function generateNodeKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return "node_" + crypto.randomUUID().slice(0, 8);
  }
  return "node_" + Math.random().toString(36).slice(2, 10);
}

// ============================================================================
// 1. CREATE (Создание узлов и деревьев)
// ============================================================================

/**
 * Создает новый узел HtmlNode с безопасными значениями по умолчанию
 * @param params Частичные параметры для инициализации
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
 * Создает базовое демонстрационное дерево HTML для быстрого старта
 */
export function createDefaultTree(): HtmlNode {
  return createNode({
    tag: "div",
    class: "p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-sans shadow-xl",
    style: "",
    _isNew: false,
    children: [
      createNode({
        tag: "header",
        class: "flex items-center justify-between pb-4 border-b border-zinc-800",
        _isNew: false,
        children: [
          createNode({
            tag: "h2",
            text: "My Awesome Component",
            class: "text-xl font-bold text-indigo-400 tracking-tight",
            _isNew: false,
            children: [],
          }),
          createNode({
            tag: "span",
            text: "Active",
            class: "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800",
            _isNew: false,
            children: [],
          }),
        ],
      }),
      createNode({
        tag: "main",
        class: "py-4 space-y-3",
        _isNew: false,
        children: [
          createNode({
            tag: "p",
            text: "This component is rendered live from an IndexedDB htmlJson tree structure.",
            class: "text-zinc-300 text-sm leading-relaxed",
            _isNew: false,
            children: [],
          }),
          createNode({
            tag: "button",
            text: "Click Me",
            class: "px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium rounded-lg transition shadow",
            attributes: { type: "button" },
            _isNew: false,
            children: [],
          }),
        ],
      }),
    ],
  });
}

/**
 * CREATE: Добавляет дочерний узел к родительскому с указанным parentKey
 * Если parentKey совпадает с корнем — ребенок добавляется в корень.
 * Если children у родителя было строкой — преобразуется в массив.
 * 
 * @param root Корневой узел дерева
 * @param parentKey Ключ родительского узла, в который вставляем
 * @param child Новый создаваемый узел
 * @returns Новое иммутабельное дерево
 */
export function addChildNode(
  root: HtmlNode,
  parentKey: string,
  child: HtmlNode
): HtmlNode {
  // Убеждаемся, что у создаваемого потомка есть уникальный ключ
  const childWithKey: HtmlNode = {
    ...child,
    _key: child._key || generateNodeKey(),
  };

  // Если текущий узел и есть родитель
  if (root._key === parentKey) {
    const existingChildren = Array.isArray(root.children)
      ? root.children
      : [];
    return {
      ...root,
      children: [...existingChildren, childWithKey],
    };
  }

  // Если это не родитель и детей-массива нет — возвращаем узел без изменений
  if (!Array.isArray(root.children)) {
    return root;
  }

  // Рекурсивно обходим детей в поисках родителя
  return {
    ...root,
    children: root.children.map((currentChild) =>
      addChildNode(currentChild, parentKey, childWithKey)
    ),
  };
}

// ============================================================================
// 2. READ (Поиск и чтение узлов дерева)
// ============================================================================

/**
 * READ: Находит узел в дереве по его _key (поиск в глубину)
 * @param root Корневой узел
 * @param key Искомый ключ
 * @returns Найденный HtmlNode или null
 */
export function findNodeByKey(root: HtmlNode, key: string): HtmlNode | null {
  if (root._key === key) {
    return root;
  }

  if (Array.isArray(root.children)) {
    for (const child of root.children) {
      const found = findNodeByKey(child, key);
      if (found) return found;
    }
  }

  return null;
}

/**
 * READ: Находит родителя узла по ключу ребенка
 * @param root Корень дерева
 * @param childKey Ключ дочернего узла
 * @returns Родительский HtmlNode или null
 */
export function findParentNode(
  root: HtmlNode,
  childKey: string
): HtmlNode | null {
  if (!Array.isArray(root.children)) return null;

  for (const child of root.children) {
    if (child._key === childKey) {
      return root;
    }
    const deeper = findParentNode(child, childKey);
    if (deeper) return deeper;
  }

  return null;
}

/**
 * READ: Подсчитывает общее количество тегов в дереве
 */
export function countNodes(node: HtmlNode): number {
  let count = 1;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

/**
 * READ: Преобразует JSON-дерево в чистую валидную строку HTML
 * @param node Корневой узел
 * @param indent Уровень отступа для форматирования
 */
export function treeToHtml(node: HtmlNode, indent = 0): string {
  const pad = "  ".repeat(indent);
  const tag = node.tag.toLowerCase();

  // Сборка атрибутов (class, style, attributes)
  const attrs: string[] = [];
  if (node.class && node.class.trim()) {
    attrs.push(`class="${escapeHtmlAttr(node.class.trim())}"`);
  }
  if (node.style && node.style.trim()) {
    attrs.push(`style="${escapeHtmlAttr(node.style.trim())}"`);
  }
  if (node.attributes) {
    for (const [attrKey, attrVal] of Object.entries(node.attributes)) {
      if (attrVal !== undefined && attrVal !== null) {
        attrs.push(`${attrKey}="${escapeHtmlAttr(String(attrVal))}"`);
      }
    }
  }

  const attrsString = attrs.length > 0 ? " " + attrs.join(" ") : "";

  // Самозакрывающиеся одиночные теги (void elements)
  const voidTags = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
  ]);

  if (voidTags.has(tag)) {
    return `${pad}<${tag}${attrsString} />`;
  }

  // Контент детей
  if (typeof node.children === "string") {
    const textContent = node.children || node.text || "";
    return `${pad}<${tag}${attrsString}>${escapeHtmlText(textContent)}</${tag}>`;
  }

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const hasText = Boolean(node.text && node.text.trim());

  if (!hasChildren && !hasText) {
    return `${pad}<${tag}${attrsString}></${tag}>`;
  }

  if (!hasChildren && hasText) {
    return `${pad}<${tag}${attrsString}>${escapeHtmlText(node.text || "")}</${tag}>`;
  }

  // Вложенные элементы
  const innerHtml = (node.children as HtmlNode[])
    .map((child) => treeToHtml(child, indent + 1))
    .join("\n");

  const optionalLeadingText = hasText
    ? `${pad}  ${escapeHtmlText(node.text || "")}\n`
    : "";

  return `${pad}<${tag}${attrsString}>\n${optionalLeadingText}${innerHtml}\n${pad}</${tag}>`;
}

function escapeHtmlAttr(str: string): string {
  return str.replace(/"/g, "&quot;");
}

function escapeHtmlText(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================================
// 3. UPDATE (Обновление свойств узла)
// ============================================================================

/**
 * UPDATE: Обновляет узел с заданным _key, применяя функцию-апдейтер или патч свойств
 * @param root Корневой узел дерева
 * @param targetKey Ключ узла, который нужно обновить
 * @param patch Частичные свойства для обновления
 * @returns Новое иммутабельное дерево
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
      _key: root._key, // сохраняем исходный ключ
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
// 4. DELETE (Удаление узла из дерева)
// ============================================================================

/**
 * DELETE: Удаляет узел с заданным _key из дерева.
 * Если передан ключ самого корня, вернет null (удаление всего дерева).
 * 
 * @param root Корневой узел дерева
 * @param targetKey Ключ удаляемого узла
 * @returns Новое дерево без удаленного узла, либо null если удален корень
 */
export function deleteNodeByKey(
  root: HtmlNode,
  targetKey: string
): HtmlNode | null {
  // Попытка удалить корень
  if (root._key === targetKey) {
    return null;
  }

  if (!Array.isArray(root.children)) {
    return root;
  }

  return {
    ...root,
    // Фильтруем прямого потомка и рекурсивно очищаем вложенных
    children: root.children
      .filter((child) => child._key !== targetKey)
      .map((child) => deleteNodeByKey(child, targetKey) as HtmlNode)
      .filter(Boolean),
  };
}
