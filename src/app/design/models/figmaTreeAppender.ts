import { getHtmlJson, saveHtmlJson, getAllHtmlJson } from "@/lib/htmlStorage";
import type { HtmlNode } from "@/types/HtmlNode";

const DEFAULT_TREE_ID = "plaza_tree";

/**
 * Оборачивает переданные ноды в общий <div> и добавляет его
 * в конец активного дерева разметки в базе, после чего диспатчит 'plaza-tree-updated'.
 */
export async function appendNodesToTree(
  newNodes: HtmlNode | HtmlNode[],
): Promise<HtmlNode[]> {
  const nodesToAdd = Array.isArray(newNodes) ? newNodes : [newNodes];
  if (nodesToAdd.length === 0) return [];

  // Создаем единый контейнер div для всего пакета нод
  const wrapperDiv: HtmlNode = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `group_${Date.now()}`,
    tag: "div",
    attributes: {},
    children: nodesToAdd,
  };

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

  // 2. Встраиваем единый wrapperDiv в структуру
  if (!currentTree) {
    // Дерево ещё пустое — создаём с оберткой
    nextTree = [wrapperDiv];
  } else if (Array.isArray(currentTree)) {
    // Дерево — плоский массив корней
    nextTree = [...currentTree, wrapperDiv];
  } else {
    // Дерево — объект корня (root HtmlNode)
    const existingChildren = Array.isArray(currentTree.children)
      ? currentTree.children
      : [];

    nextTree = [
      {
        ...currentTree,
        children: [...existingChildren, wrapperDiv],
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

