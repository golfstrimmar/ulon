import {
  getHtmlJson,
  saveHtmlJson,
  getAllHtmlJson,
  getGlobalScss,
  saveGlobalScss,
} from "@/store/htmlStorage";
import {
  getColorVariables,
  embedColorVariablesIntoScss,
} from "@/store/figmaColorStorage";
import { updateClassInGlobalScss } from "@/lib/scssCompiler";
import type { HtmlNode } from "@/types/HtmlNode";

const DEFAULT_TREE_ID = "plaza_tree";

function formatStyleBody(styleStr: string): string {
  const trimmedStyle = styleStr.trim();
  if (!trimmedStyle) return "";
  if (trimmedStyle.includes("{")) {
    return `  ${trimmedStyle}`;
  }
  return trimmedStyle
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `  ${s};`)
    .join("\n");
}

/**
 * Выносит inline `style` в `classStylesMap` под классы (создавая `--2`, `--3` при разных стилях
 * у одного и того же класса) и полностью удаляет `style` с самой HtmlNode.
 */
function extractAndStripNodeStyles(
  node: HtmlNode,
  classStylesMap: Map<string, string>,
  classOccurrenceCounter: Map<string, number>,
): HtmlNode {
  let nextClass = node.class || "";
  let nextStyle = node.style || "";

  if (nextStyle.trim()) {
    const scssProps = formatStyleBody(nextStyle);
    const classNames = nextClass
      .split(/\s+/)
      .map((c) => c.trim().replace(/^\./, ""))
      .filter(Boolean);

    if (scssProps) {
      if (classNames.length > 0) {
        const primaryCls = classNames[0];
        const existingBody = classStylesMap.get(primaryCls);

        if (!existingBody) {
          classStylesMap.set(primaryCls, scssProps);
        } else if (existingBody !== scssProps && primaryCls !== "is") {
          let matchedExistingMod: string | null = null;
          for (const [k, v] of classStylesMap.entries()) {
            if (k.startsWith(`${primaryCls}--`) && v === scssProps) {
              matchedExistingMod = k;
              break;
            }
          }

          if (matchedExistingMod) {
            if (!classNames.includes(matchedExistingMod)) {
              nextClass = [...classNames, matchedExistingMod].join(" ");
            }
          } else {
            const count = (classOccurrenceCounter.get(primaryCls) || 1) + 1;
            classOccurrenceCounter.set(primaryCls, count);
            const modClass = `${primaryCls}--${count}`;
            classStylesMap.set(modClass, scssProps);
            nextClass = [...classNames, modClass].join(" ");
          }
        }
        nextStyle = "";
      } else {
        const fallbackCls = `node-${(node._key || Math.random().toString(36).slice(2, 8)).replace(/[^a-zA-Z0-9_-]/g, "")}`;
        classStylesMap.set(fallbackCls, scssProps);
        nextClass = fallbackCls;
        nextStyle = "";
      }
    } else {
      nextStyle = "";
    }
  }

  const nextChildren = Array.isArray(node.children)
    ? node.children.map((child) =>
        extractAndStripNodeStyles(
          child,
          classStylesMap,
          classOccurrenceCounter,
        ),
      )
    : node.children;

  const cleaned: any = {
    ...node,
    class: nextClass,
    children: nextChildren,
  };
  if (nextStyle) {
    cleaned.style = nextStyle;
  } else {
    delete cleaned.style;
  }

  return cleaned as HtmlNode;
}

export async function appendNodesToTree(
  newNodes: HtmlNode | HtmlNode[],
): Promise<HtmlNode[]> {
  const rawNodesToAdd = Array.isArray(newNodes) ? newNodes : [newNodes];
  if (rawNodesToAdd.length === 0) return [];

  const classStylesMap = new Map<string, string>();
  const classOccurrenceCounter = new Map<string, number>();

  const nodesToAdd = rawNodesToAdd.map((node) =>
    extractAndStripNodeStyles(node, classStylesMap, classOccurrenceCounter),
  );

  let currentTree = await getHtmlJson(DEFAULT_TREE_ID);
  let targetId = DEFAULT_TREE_ID;

  if (!currentTree) {
    const allTrees = await getAllHtmlJson();
    if (allTrees.length > 0) {
      targetId = allTrees[0].id;
      currentTree = allTrees[0].root;
    }
  }

  let nextTree: HtmlNode[];

  if (!currentTree) {
    nextTree = nodesToAdd;
  } else if (Array.isArray(currentTree)) {
    nextTree = [...currentTree, ...nodesToAdd];
  } else {
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

  await saveHtmlJson(targetId, nextTree);

  try {
    const [rawScss, colorVars] = await Promise.all([
      getGlobalScss().catch(() => ""),
      getColorVariables().catch(() => []),
    ]);

    let currentScss = rawScss || "";

    if (Array.isArray(colorVars) && colorVars.length > 0) {
      currentScss = embedColorVariablesIntoScss(currentScss, colorVars);
    }

    if (classStylesMap.size > 0) {
      for (const [cls, scssProps] of classStylesMap.entries()) {
        const fullSnippet = `.${cls} {\n${scssProps}\n}`;
        currentScss = updateClassInGlobalScss(currentScss, cls, fullSnippet);
      }
    }

    if (currentScss !== (rawScss || "")) {
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

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("plaza-tree-updated", { detail: nextTree }),
    );
  }

  return nextTree;
}
