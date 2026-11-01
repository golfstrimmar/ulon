import {
  getHtmlJson,
  saveHtmlJson,
  getAllHtmlJson,
  getGlobalScss,
  saveGlobalScss,
} from "@/lib/htmlStorage";
import { updateClassInGlobalScss } from "@/lib/scssCompiler";
import type { HtmlNode } from "@/types/HtmlNode";

const DEFAULT_TREE_ID = "plaza_tree";

/**
 * Рекурсивный сбор классов и связанных CSS-свойств со всех переданных нод
 */
function extractNodeClassesAndStyles(
  node: HtmlNode,
  result: Map<string, string>,
) {
  if (node.class && node.style) {
    const classNames = node.class
      .split(/\s+/)
      .map((c) => c.trim().replace(/^\./, ""))
      .filter(Boolean);

    const scssProps = node.style
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `  ${s};`)
      .join("\n");

    if (scssProps) {
      for (const cls of classNames) {
        if (!result.has(cls)) {
          result.set(cls, scssProps);
        }
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      extractNodeClassesAndStyles(child, result);
    }
  }
}

/**
 * Добавляет переданные ноды напрямую в конец активного дерева разметки
 * в базе, синхронизирует SCSS-стили классов в глобальный бандл (classes_css),
 * после чего диспатчит события обновления.
 */
export async function appendNodesToTree(
  newNodes: HtmlNode | HtmlNode[],
): Promise<HtmlNode[]> {
  const nodesToAdd = Array.isArray(newNodes) ? newNodes : [newNodes];
  if (nodesToAdd.length === 0) return [];

  // 1. Ищем существующее дерево: сначала пробуем plaza_tree
  let currentTree = await getHtmlJson(DEFAULT_TREE_ID);
  let targetId = DEFAULT_TREE_ID;

  // Если plaza_tree нет, смотрим первую попавшуюся запись в БД
  if (!currentTree) {
    const allTrees = await getAllHtmlJson();
    if (allTrees.length > 0) {
      targetId = allTrees[0].id;
      currentTree = allTrees[0].root;
    }
  }

  let nextTree: HtmlNode[];

  // 2. Встраиваем новые ноды напрямую в структуру
  if (!currentTree) {
    // Дерево ещё пустое — новые ноды становятся корнем
    nextTree = nodesToAdd;
  } else if (Array.isArray(currentTree)) {
    // Дерево — плоский массив: докидываем в конец списка
    nextTree = [...currentTree, ...nodesToAdd];
  } else {
    // Дерево — один корневой объект: добавляем в его children
    const existingChildren = Array.isArray(currentTree.children)
      ? currentTree.children
      : [];

    nextTree = [
      {
        ...currentTree,
        children: [...existingChildren, ...nodesToAdd],
      },
    ];
  }

  // 3. Сохраняем обновленное дерево в IndexedDB
  await saveHtmlJson(targetId, nextTree);

  // 4. Синхронизируем стили классов из нод в глобальный SCSS (classes_css)
  try {
    const classStylesMap = new Map<string, string>();
    for (const node of nodesToAdd) {
      extractNodeClassesAndStyles(node, classStylesMap);
    }

    if (classStylesMap.size > 0) {
      let currentScss = await getGlobalScss().catch(() => "");
      for (const [cls, scssProps] of classStylesMap.entries()) {
        const fullSnippet = `.${cls} {\n${scssProps}\n}`;
        currentScss = updateClassInGlobalScss(currentScss, cls, fullSnippet);
      }
      await saveGlobalScss(currentScss);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("plaza-styles-updated", { detail: currentScss }),
        );
      }
    }
  } catch (scssErr) {
    console.error("Ошибка синхронизации SCSS стилей для нод:", scssErr);
  }

  // 5. Оповещаем всю систему об обновлении дерева
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("plaza-tree-updated", { detail: nextTree }),
    );
  }

  return nextTree;
}
