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
import { updateClassInGlobalScss, escapeRegex } from "@/lib/scssCompiler";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  parseCssDeclarations,
  formatCssDeclarations,
  computeCssPropertiesDiff,
  extractClassPropertiesFromScss,
} from "../utils/figmaCssUtils";

const DEFAULT_TREE_ID = "plaza_tree";

function purgeEmptyRules(scss: string): string {
  if (!scss) return "";
  return scss
    .replace(/(?:^|\n)[ \t]*\.[a-zA-Z0-9_-]+\s*\{\s*\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findExistingModifier(
  primaryCls: string,
  targetDiffFormatted: string,
  classStylesMap: Map<string, string>,
  currentScss: string,
): string | null {
  // 1. Проверяем в текущем Map новой пачки
  for (const [k, v] of classStylesMap.entries()) {
    if (
      k.startsWith(`${primaryCls}--`) &&
      v.trim() === targetDiffFormatted.trim()
    ) {
      return k;
    }
  }

  // 2. Проверяем в существующем globalScss
  if (currentScss) {
    const escaped = escapeRegex(primaryCls);
    const modRegex = new RegExp(
      `(^|\\n)[ \\t]*\\.${escaped}--([a-zA-Z0-9_-]+)`,
      "g",
    );
    let match: RegExpExecArray | null;
    const checked = new Set<string>();

    const targetProps = parseCssDeclarations(targetDiffFormatted);

    while ((match = modRegex.exec(currentScss)) !== null) {
      const candidateName = `${primaryCls}--${match[2]}`;
      if (checked.has(candidateName)) continue;
      checked.add(candidateName);

      const existingProps = extractClassPropertiesFromScss(
        currentScss,
        candidateName,
      );
      if (existingProps.size === targetProps.size) {
        const diff1 = computeCssPropertiesDiff(existingProps, targetProps);
        const diff2 = computeCssPropertiesDiff(targetProps, existingProps);
        if (diff1.size === 0 && diff2.size === 0) {
          return candidateName;
        }
      }
    }
  }

  return null;
}

function getNextModifierClass(
  primaryCls: string,
  currentScss: string,
  classStylesMap: Map<string, string>,
  occurrenceCounter: Map<string, number>,
): string {
  if (!occurrenceCounter.has(primaryCls)) {
    let maxNum = 1;
    for (const k of classStylesMap.keys()) {
      if (k.startsWith(`${primaryCls}--`)) {
        const suffix = k.slice(`${primaryCls}--`.length);
        const n = parseInt(suffix, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    if (currentScss) {
      const escaped = escapeRegex(primaryCls);
      const modRegex = new RegExp(`(^|\\n)[ \\t]*\\.${escaped}--(\\d+)`, "g");
      let match: RegExpExecArray | null;
      while ((match = modRegex.exec(currentScss)) !== null) {
        const n = parseInt(match[2], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    occurrenceCounter.set(primaryCls, maxNum);
  }

  const nextNum = (occurrenceCounter.get(primaryCls) || 1) + 1;
  occurrenceCounter.set(primaryCls, nextNum);
  return `${primaryCls}--${nextNum}`;
}

/**
 * Выносит inline `style` в `classStylesMap`:
 * - Первый узел с классом `primaryCls` сохраняет свои свойства как базовые в `classStylesMap`.
 * - Последующие узлы с тем же классом сравниваются с базовым классом (из пачки или из globalScss).
 * - Если свойства совпадают — модификатор НЕ создается, нода сохраняет `primaryCls`.
 * - Если свойства отличаются — создается модификатор `--2`, в который записывается **СТРОГО ДЕЛЬТА**
 *   (только отличающиеся или добавленные свойства).
 * - Полностью очищает `style` на ноде.
 */
function extractAndStripNodeStyles(
  node: HtmlNode,
  classStylesMap: Map<string, string>,
  classOccurrenceCounter: Map<string, number>,
  currentScss: string,
): HtmlNode {
  let nextClass = (node.class || "").trim();
  let nextStyle = (node.style || "").trim();

  if (nextStyle) {
    // Если это вложенный SCSS (например `.is -> img { ... }`)
    if (nextStyle.includes("{")) {
      const scssProps = `  ${nextStyle}`;
      const classNames = nextClass
        .split(/\s+/)
        .map((c) => c.trim().replace(/^\./, ""))
        .filter(Boolean);

      if (classNames.length > 0) {
        const primaryCls = classNames[0];
        if (!classStylesMap.has(primaryCls)) {
          classStylesMap.set(primaryCls, scssProps);
        }
      }
      nextStyle = "";
    } else {
      const currentProps = parseCssDeclarations(nextStyle);

      if (currentProps.size > 0) {
        const classNames = nextClass
          .split(/\s+/)
          .map((c) => c.trim().replace(/^\./, ""))
          .filter(Boolean);

        let primaryCls = classNames.length > 0 ? classNames[0] : "";
        if (!primaryCls) {
          primaryCls = `node-${(node._key || Math.random().toString(36).slice(2, 8)).replace(/[^a-zA-Z0-9_-]/g, "")}`;
          classNames.push(primaryCls);
        }

        // Получаем существующие свойства этого класса
        let baseProps: Map<string, string>;
        if (classStylesMap.has(primaryCls)) {
          baseProps = parseCssDeclarations(classStylesMap.get(primaryCls)!);
        } else {
          baseProps = extractClassPropertiesFromScss(currentScss, primaryCls);
        }

        if (baseProps.size === 0) {
          // Базового класса еще нет — регистрируем его со всеми его свойствами
          classStylesMap.set(primaryCls, formatCssDeclarations(currentProps));
        } else if (primaryCls !== "is") {
          // Базовый класс уже есть — ВЫЧИСЛЯЕМ ДЕЛЬТУ
          const diff = computeCssPropertiesDiff(baseProps, currentProps);

          if (diff.size > 0) {
            // Записываем в модификатор СТРОГО ДЕЛЬТУ отличающихся свойств
            const diffFormatted = formatCssDeclarations(diff);
            const matchedMod = findExistingModifier(
              primaryCls,
              diffFormatted,
              classStylesMap,
              currentScss,
            );

            if (matchedMod) {
              if (!classNames.includes(matchedMod)) {
                classNames.push(matchedMod);
              }
            } else {
              const newModClass = getNextModifierClass(
                primaryCls,
                currentScss,
                classStylesMap,
                classOccurrenceCounter,
              );
              classStylesMap.set(newModClass, diffFormatted);
              classNames.push(newModClass);
            }
          }
          // Если diff.size === 0 — свойства идентичны базовому классу, модификатор не создаем!
        }

        nextClass = classNames.join(" ");
      }

      nextStyle = "";
    }
  }

  const nextChildren = Array.isArray(node.children)
    ? node.children.map((child) =>
        extractAndStripNodeStyles(
          child,
          classStylesMap,
          classOccurrenceCounter,
          currentScss,
        ),
      )
    : node.children;

  const cleaned: any = {
    ...node,
    class: nextClass,
    children: nextChildren,
  };
  delete cleaned.style;

  return cleaned as HtmlNode;
}

export async function appendNodesToTree(
  newNodes: HtmlNode | HtmlNode[],
): Promise<HtmlNode[]> {
  const rawNodesToAdd = Array.isArray(newNodes) ? newNodes : [newNodes];
  if (rawNodesToAdd.length === 0) return [];

  // 1. Загружаем существующий глобальный SCSS и :root переменные
  const [rawScss, colorVars] = await Promise.all([
    getGlobalScss().catch(() => ""),
    getColorVariables().catch(() => []),
  ]);

  let currentScss = rawScss || "";
  if (Array.isArray(colorVars) && colorVars.length > 0) {
    currentScss = embedColorVariablesIntoScss(currentScss, colorVars);
  }

  // Очищаем пустые селекторы (если они были сохранены ранее)
  currentScss = purgeEmptyRules(currentScss);

  // 2. Обрабатываем ноды: выносим inline styles, дедуплицируем свойства с вычислением дельты
  const classStylesMap = new Map<string, string>();
  const classOccurrenceCounter = new Map<string, number>();

  const nodesToAdd = rawNodesToAdd.map((node) =>
    extractAndStripNodeStyles(
      node,
      classStylesMap,
      classOccurrenceCounter,
      currentScss,
    ),
  );

  // 3. Сохраняем ноды в дерево IndexedDB
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

  // 4. Синхронизируем новые и обновленные классы в глобальный SCSS
  try {
    if (classStylesMap.size > 0) {
      for (const [cls, scssProps] of classStylesMap.entries()) {
        const fullSnippet = `.${cls} {\n${scssProps}\n}`;
        currentScss = updateClassInGlobalScss(currentScss, cls, fullSnippet);
      }
    }

    currentScss = purgeEmptyRules(currentScss);

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

  // 5. Оповещаем всю систему об обновлении дерева
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("plaza-tree-updated", { detail: nextTree }),
    );
  }

  return nextTree;
}
