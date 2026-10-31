import { getHtmlJson, saveHtmlJson, getAllHtmlJson } from "@/lib/htmlStorage";
import type { HtmlNode } from "@/types/HtmlNode";

const DEFAULT_TREE_ID = "plaza_tree";

/**
 * Добавляет переданные ноды напрямую в конец активного дерева разметки
 * в базе, после чего диспатчит событие 'plaza-tree-updated'.
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

  // 4. Оповещаем всю систему об обновлении
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("plaza-tree-updated", { detail: nextTree }),
    );
  }

  return nextTree;
}
