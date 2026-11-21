import type { HtmlNode } from "@/types/HtmlNode";
import {
  computeBoundingRect,
  isContained,
  isSameBounds,
  mergeInlineStyles,
  type LayoutNode,
  type LayoutRect,
  type OverlayMetrics,
  type RawFigmaNodeEntry,
  type WireframeBox,
} from "./wireframeTypes";
import {
  collectFigmaNodesFromTree,
  extractCssFromSvgNode,
} from "./wireframeFigmaCollector";
import {
  computeFlexStyle,
  detectUniformCardGrid,
  getGroupProfile,
  groupIntoUniformRuns,
  hasUniformBlocks,
  isInternalUniformList,
  measureBandGaps,
  medianGap,
  splitByLargeGaps,
  splitIntoBands,
} from "./wireframeListPresets";

const NON_UL_PARENT_TAGS = new Set([
  "section",
  "header",
  "footer",
  "nav",
  "ul",
  "li",
  "a",
  "button",
]);

export function buildWireframeBoxesFromTree(
  tree: HtmlNode[],
  options: {
    containerWidth: number;
    overlayMetrics?: OverlayMetrics;
    scaleMode?: "auto" | "1x" | "2x";
    existingDonorKeys?: Set<string>;
  },
): WireframeBox[] {
  const entries = collectFigmaNodesFromTree(tree).filter(
    (e) => !options.existingDonorKeys?.has(e.key),
  );
  if (entries.length === 0) return [];

  const uniqueSections = new Set(
    entries.map((e) => e.sectionId).filter(Boolean),
  );
  const usePageCoords = uniqueSections.size > 1;

  let refWidth = 0;
  for (const e of entries) {
    const x = usePageCoords ? e.pageX : e.x;
    const right = x + e.width;
    if (right > refWidth) refWidth = right;
    if (e.sectionWidth > refWidth) {
      refWidth = e.sectionWidth;
    }
  }

  let scale = 1;
  const imgW = options.overlayMetrics?.imgWidth || 0;
  if (options.scaleMode === "2x") {
    scale = 2;
  } else if (options.scaleMode === "1x") {
    scale = 1;
  } else if (
    options.overlayMetrics?.hasActiveOverlay &&
    imgW > 0 &&
    refWidth > 0
  ) {
    const ratio = imgW / refWidth;
    if (Math.abs(ratio - 2) < 0.08) {
      scale = 2;
    } else if (ratio < 0.98) {
      scale = ratio;
    } else {
      scale = 1;
    }
  }

  let originX = 0;
  let originY = 0;

  if (options.overlayMetrics?.hasActiveOverlay) {
    originY = options.overlayMetrics.offsetY || 0;
    if (
      options.overlayMetrics.align === "center" &&
      options.containerWidth > 0
    ) {
      const targetWidth = imgW > 0 ? imgW : refWidth * scale;
      originX =
        (options.containerWidth - targetWidth) / 2 +
        (options.overlayMetrics.offsetX || 0);
    } else {
      originX = options.overlayMetrics.offsetX || 0;
    }
  }

  const stamp = Date.now();
  let seq = 0;
  const nextId = (prefix: string) =>
    `${prefix}_${stamp}_${seq++}_${Math.random().toString(36).substring(2, 6)}`;

  const toScreenRect = (e: RawFigmaNodeEntry): LayoutRect => {
    const rawX = usePageCoords ? e.pageX : e.x;
    const rawY = usePageCoords ? e.pageY : e.y;
    return {
      x: Math.round(originX + rawX * scale),
      y: Math.round(originY + rawY * scale),
      width: Math.max(2, Math.round(e.width * scale)),
      height: Math.max(2, Math.round(e.height * scale)),
    };
  };

  // 1. Начальные LayoutNode
  let initialItems: LayoutNode[] = entries.map((entry) => {
    const rect = toScreenRect(entry);
    return {
      entry,
      rect,
      children: [],
      isExplicitContainer: entry.isContainerNode,
      box: {
        id: nextId("figma_box"),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scale,
        tag: entry.isContainerNode ? entry.tag || "div" : "",
        donorKey: entry.key,
        sortPriority: entry.isContainerNode ? 3 : 0,
      },
    };
  });

  // 2. Фоновые SVG-прямоугольники -> div-контейнеры (или слияние с секцией)
  const absorbedKeys = new Set<string>();
  const tol = Math.max(4, Math.round(4 * scale));

  for (const item of initialItems) {
    if (!item.entry.isSvgShape) continue;

    const matchingSection = initialItems.find(
      (other) =>
        other !== item &&
        other.entry.isContainerNode &&
        isSameBounds(item.rect, other.rect, tol),
    );

    const extractedCss = extractCssFromSvgNode(item.entry.node);

    if (matchingSection) {
      if (extractedCss) {
        matchingSection.box.style = mergeInlineStyles(
          matchingSection.box.style,
          extractedCss,
        );
      }
      matchingSection.box.consumedDonorKeys = [
        ...(matchingSection.box.consumedDonorKeys || []),
        item.entry.key,
      ];
      absorbedKeys.add(item.entry.key);
      continue;
    }

    const containedCount = initialItems.filter(
      (other) =>
        other !== item &&
        !other.entry.isContainerNode &&
        !absorbedKeys.has(other.entry.key) &&
        isContained(other.rect, item.rect, tol) &&
        other.rect.width * other.rect.height <
          item.rect.width * item.rect.height * 0.9,
    ).length;

    if (containedCount >= 1) {
      item.isExplicitContainer = true;
      item.box = {
        id: item.box.id,
        x: item.rect.x,
        y: item.rect.y,
        width: item.rect.width,
        height: item.rect.height,
        scale,
        tag: "div",
        style: extractedCss || undefined,
        consumedDonorKeys: [item.entry.key],
        sortPriority: 3,
      };
    }
  }

  if (absorbedKeys.size > 0) {
    initialItems = initialItems.filter((it) => !absorbedKeys.has(it.entry.key));
  }

  // 3. Предварительное дерево вложенности существующих контейнеров
  initialItems.sort((a, b) => {
    const areaDiff =
      b.rect.width * b.rect.height - a.rect.width * a.rect.height;
    if (areaDiff !== 0) return areaDiff;
    return (
      (b.entry.isContainerNode ? 1 : 0) - (a.entry.isContainerNode ? 1 : 0)
    );
  });

  const rootItems: LayoutNode[] = [];
  for (let i = 0; i < initialItems.length; i++) {
    const current = initialItems[i];
    let bestParent: LayoutNode | null = null;

    for (let j = 0; j < i; j++) {
      const candidate = initialItems[j];
      if (!candidate.isExplicitContainer) continue;

      if (isContained(current.rect, candidate.rect, tol)) {
        if (
          !bestParent ||
          candidate.rect.width * candidate.rect.height <=
            bestParent.rect.width * bestParent.rect.height
        ) {
          bestParent = candidate;
        }
      }
    }

    if (bestParent) {
      current.box.parentId = bestParent.box.id;
      bestParent.children.push(current);
    } else {
      rootItems.push(current);
    }
  }

  const rootContainerIds = new Set(rootItems.map((r) => r.box.id));
  const generatedBoxes: WireframeBox[] = [];

  const assignGroupParent = (group: LayoutNode[], pid?: string) => {
    if (!pid) return;
    for (const n of group) {
      n.box.parentId = pid;
    }
  };

  function canConvertBoxToUl(box: WireframeBox | null): boolean {
    if (!box) return false;
    if (rootContainerIds.has(box.id)) return false;
    const tag = (box.tag || "").trim().toLowerCase();
    if (NON_UL_PARENT_TAGS.has(tag)) return false;
    if (box.donorKey) {
      const donorEntry = entries.find((e) => e.key === box.donorKey);
      const classes = (donorEntry?.node.class || "").toLowerCase().split(/\s+/);
      if (classes.includes("container")) return false;
    }
    return true;
  }

  function materializeListItem(
    group: LayoutNode[],
    allowFlexGrow: boolean,
    ulParentId?: string,
  ): { rect: LayoutRect; box: WireframeBox } {
    if (group.length === 1) {
      const only = group[0];
      if (only.isExplicitContainer) {
        only.box.tag = "li";
        only.box.sortPriority = 1;
        if (ulParentId) only.box.parentId = ulParentId;
        if (allowFlexGrow) {
          only.box.style = mergeInlineStyles(only.box.style, "flex: 1;");
        }
        if (only.children.length > 0) {
          layoutSubtree(only.children, only.box, only.box.id);
        }
        return { rect: only.rect, box: only.box };
      }

      const liBox: WireframeBox = {
        id: nextId("li_box"),
        x: only.rect.x,
        y: only.rect.y,
        width: only.rect.width,
        height: only.rect.height,
        scale,
        tag: "li",
        style: allowFlexGrow ? "flex: 1;" : undefined,
        sortPriority: 1,
        parentId: ulParentId,
      };
      only.box.parentId = liBox.id;
      generatedBoxes.push(liBox);
      return { rect: only.rect, box: liBox };
    }

    const rect = computeBoundingRect(group);
    const liBox: WireframeBox = {
      id: nextId("li_box"),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale,
      tag: "li",
      style: allowFlexGrow ? "flex: 1;" : undefined,
      sortPriority: 1,
      parentId: ulParentId,
    };
    assignGroupParent(group, liBox.id);
    generatedBoxes.push(liBox);
    layoutSubtree(group, liBox, liBox.id);
    return { rect, box: liBox };
  }

  function materializeRegularColumn(
    group: LayoutNode[],
    enclosingParentId?: string,
  ): { rect: LayoutRect; box?: WireframeBox } {
    if (group.length === 1) {
      if (enclosingParentId) group[0].box.parentId = enclosingParentId;
      if (group[0].children.length > 0) {
        layoutSubtree(group[0].children, group[0].box, group[0].box.id);
      }
      return { rect: group[0].rect, box: group[0].box };
    }

    const colRect = computeBoundingRect(group);
    const colBox: WireframeBox = {
      id: nextId("col_box"),
      x: colRect.x,
      y: colRect.y,
      width: colRect.width,
      height: colRect.height,
      scale,
      tag: "div",
      sortPriority: 2,
      parentId: enclosingParentId,
    };
    assignGroupParent(group, colBox.id);
    generatedBoxes.push(colBox);
    layoutSubtree(group, colBox, colBox.id);
    return { rect: colRect, box: colBox };
  }

  function emitColumnsAsFlexRow(
    cols: LayoutNode[][],
    parentBox: WireframeBox | null,
    fallbackParentId?: string,
  ) {
    const effectiveParentId = parentBox ? parentBox.id : fallbackParentId;
    const colItems = cols.map((col) =>
      materializeRegularColumn(col, effectiveParentId),
    );

    if (colItems.length >= 2) {
      if (parentBox) {
        parentBox.style = computeFlexStyle(
          colItems,
          "row",
          scale,
          parentBox.style,
        );
        for (const it of colItems) {
          if (it.box) it.box.parentId = parentBox.id;
        }
      } else {
        const rowRect = computeBoundingRect(colItems);
        const rowBox: WireframeBox = {
          id: nextId("row_box"),
          x: rowRect.x,
          y: rowRect.y,
          width: rowRect.width,
          height: rowRect.height,
          scale,
          tag: "div",
          style: computeFlexStyle(colItems, "row", scale),
          sortPriority: 2,
          parentId: fallbackParentId,
        };
        for (const it of colItems) {
          if (it.box) it.box.parentId = rowBox.id;
        }
        generatedBoxes.push(rowBox);
      }
    }
  }

  function emitRowsAsColumnStack(
    rows: LayoutNode[][],
    parentBox: WireframeBox | null,
    fallbackParentId?: string,
  ) {
    const effectiveParentId = parentBox ? parentBox.id : fallbackParentId;
    for (const row of rows) {
      if (row.length === 1) {
        if (effectiveParentId) row[0].box.parentId = effectiveParentId;
        if (row[0].children.length > 0) {
          layoutSubtree(row[0].children, row[0].box, row[0].box.id);
        }
      } else {
        layoutSubtree(row, null, effectiveParentId);
      }
    }
  }

  function emitGroupsInDirection(
    groups: LayoutNode[][],
    direction: "row" | "column",
    parentBox: WireframeBox | null,
    fallbackParentId?: string,
  ) {
    const effectiveParentId = parentBox ? parentBox.id : fallbackParentId;

    const innerDir = direction === "row" ? "column" : "row";
    const listGroupsCount = groups.filter((g) =>
      isInternalUniformList(g, innerDir, scale),
    ).length;

    if (listGroupsCount >= 2) {
      if (direction === "row") {
        emitColumnsAsFlexRow(groups, parentBox, fallbackParentId);
      } else {
        emitRowsAsColumnStack(groups, parentBox, fallbackParentId);
      }
      return;
    }

    const runs = groupIntoUniformRuns(groups, direction, scale);
    const isWholeParentASingleList =
      runs.length === 1 && runs[0].isList && canConvertBoxToUl(parentBox);

    if (isWholeParentASingleList) {
      const listItems = runs[0].items;
      const widths = listItems.map((g) => computeBoundingRect(g).width);
      const equalWidths =
        direction === "row" &&
        Math.max(...widths) / Math.max(1, Math.min(...widths)) <= 1.25 &&
        getGroupProfile(listItems[0]).isComposite;

      parentBox!.tag = "ul";
      const items = listItems.map((g) =>
        materializeListItem(g, equalWidths, parentBox!.id),
      );
      parentBox!.style = computeFlexStyle(
        items,
        direction,
        scale,
        parentBox!.style,
      );
      return;
    }

    const topLevelItemsForParent: { rect: LayoutRect; box?: WireframeBox }[] =
      [];

    for (const run of runs) {
      if (run.isList) {
        const listItems = run.items;
        const widths = listItems.map((g) => computeBoundingRect(g).width);
        const equalWidths =
          direction === "row" &&
          Math.max(...widths) / Math.max(1, Math.min(...widths)) <= 1.25 &&
          getGroupProfile(listItems[0]).isComposite;

        const ulId = nextId("ul_box");
        const ulBox: WireframeBox = {
          id: ulId,
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          scale,
          tag: "ul",
          sortPriority: 2,
          parentId: effectiveParentId,
        };
        generatedBoxes.push(ulBox);

        const items = listItems.map((g) =>
          materializeListItem(g, equalWidths, ulId),
        );
        const ulRect = computeBoundingRect(items);
        ulBox.x = ulRect.x;
        ulBox.y = ulRect.y;
        ulBox.width = ulRect.width;
        ulBox.height = ulRect.height;
        ulBox.style = computeFlexStyle(items, direction, scale);

        topLevelItemsForParent.push({ rect: ulRect, box: ulBox });
      } else {
        const group = run.items[0];
        if (direction === "row") {
          topLevelItemsForParent.push(
            materializeRegularColumn(group, effectiveParentId),
          );
        } else {
          if (group.length === 1) {
            if (effectiveParentId) group[0].box.parentId = effectiveParentId;
            if (group[0].children.length > 0) {
              layoutSubtree(group[0].children, group[0].box, group[0].box.id);
            }
            topLevelItemsForParent.push({
              rect: group[0].rect,
              box: group[0].box,
            });
          } else {
            const bandCols = splitIntoBands(group, "x");
            if (bandCols.length >= 2) {
              emitGroupsInDirection(bandCols, "row", null, effectiveParentId);
            } else {
              layoutSubtree(group, null, effectiveParentId);
            }
            topLevelItemsForParent.push({ rect: computeBoundingRect(group) });
          }
        }
      }
    }

    if (direction === "row" && topLevelItemsForParent.length >= 2) {
      if (parentBox) {
        parentBox.style = computeFlexStyle(
          topLevelItemsForParent,
          "row",
          scale,
          parentBox.style,
        );
        for (const it of topLevelItemsForParent) {
          if (it.box) it.box.parentId = parentBox.id;
        }
      } else {
        const rowRect = computeBoundingRect(topLevelItemsForParent);
        const rowBox: WireframeBox = {
          id: nextId("row_box"),
          x: rowRect.x,
          y: rowRect.y,
          width: rowRect.width,
          height: rowRect.height,
          scale,
          tag: "div",
          style: computeFlexStyle(topLevelItemsForParent, "row", scale),
          sortPriority: 2,
          parentId: fallbackParentId,
        };
        for (const it of topLevelItemsForParent) {
          if (it.box) it.box.parentId = rowBox.id;
        }
        generatedBoxes.push(rowBox);
      }
    }
  }

  function layoutSubtree(
    items: LayoutNode[],
    parentBox: WireframeBox | null,
    fallbackParentId?: string,
  ) {
    if (items.length === 0) return;

    const effectiveParentId = parentBox ? parentBox.id : fallbackParentId;

    if (items.length === 1) {
      if (effectiveParentId) items[0].box.parentId = effectiveParentId;
      if (items[0].children.length > 0) {
        layoutSubtree(items[0].children, items[0].box, items[0].box.id);
      }
      return;
    }

    const yBands = splitIntoBands(items, "y");
    const xCols = splitIntoBands(items, "x");

    if (yBands.length === 1) {
      if (xCols.length >= 2) {
        emitGroupsInDirection(xCols, "row", parentBox, fallbackParentId);
      } else {
        for (const it of items) {
          if (effectiveParentId) it.box.parentId = effectiveParentId;
          if (it.children.length > 0) {
            layoutSubtree(it.children, it.box, it.box.id);
          }
        }
      }
      return;
    }

    if (xCols.length === 1) {
      emitGroupsInDirection(yBands, "column", parentBox, fallbackParentId);
      return;
    }

    // Проверяем, есть ли явные повторяющиеся мотивы или 2D-сетка карточек
    const cardGrid = detectUniformCardGrid(yBands, scale);
    if (cardGrid) {
      const useParentAsUl = canConvertBoxToUl(parentBox);
      const ulId = useParentAsUl ? parentBox!.id : nextId("ul_box");

      const gridGapCss =
        cardGrid.gapX > 0 || cardGrid.gapY > 0
          ? cardGrid.gapY === cardGrid.gapX
            ? `gap: ${cardGrid.gapX}px;`
            : `gap: ${cardGrid.gapY}px ${cardGrid.gapX}px;`
          : "";
      const wrapCss = `display: flex; flex-direction: row; flex-wrap: wrap; align-items: stretch; ${gridGapCss}`;

      if (useParentAsUl) {
        parentBox!.tag = "ul";
        parentBox!.style = mergeInlineStyles(parentBox!.style, wrapCss);
        cardGrid.cells.forEach((cell) => {
          materializeListItem(cell, false, ulId);
        });
      } else {
        const ulBox: WireframeBox = {
          id: ulId,
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          scale,
          tag: "ul",
          style: mergeInlineStyles(undefined, wrapCss),
          sortPriority: 2,
          parentId: effectiveParentId,
        };
        generatedBoxes.push(ulBox);
        const cellItems = cardGrid.cells.map((cell) =>
          materializeListItem(cell, false, ulId),
        );
        const gridRect = computeBoundingRect(cellItems);
        ulBox.x = gridRect.x;
        ulBox.y = gridRect.y;
        ulBox.width = gridRect.width;
        ulBox.height = gridRect.height;
      }
      return;
    }

    const yHasUniform = hasUniformBlocks(yBands, "column", scale);
    const xHasUniform = hasUniformBlocks(xCols, "row", scale);

    if (yHasUniform && !xHasUniform) {
      emitGroupsInDirection(yBands, "column", parentBox, fallbackParentId);
      return;
    }
    if (xHasUniform && !yHasUniform) {
      emitGroupsInDirection(xCols, "row", parentBox, fallbackParentId);
      return;
    }

    // Макро-разбиение по крупным зазорам, чтобы не разрывать мелкие пары внутри колонки/строки
    const xGaps = measureBandGaps(xCols, "x", scale);
    const yGaps = measureBandGaps(yBands, "y", scale);
    const medGapX = medianGap(xGaps);
    const medGapY = medianGap(yGaps);
    const maxGapX = xGaps.length > 0 ? Math.max(...xGaps) : 0;
    const maxGapY = yGaps.length > 0 ? Math.max(...yGaps) : 0;
    const minGapX = xGaps.length > 0 ? Math.min(...xGaps) : 0;
    const minGapY = yGaps.length > 0 ? Math.min(...yGaps) : 0;

    if (maxGapX > Math.max(medGapY, minGapX) + 8) {
      const macroCols = splitByLargeGaps(
        items,
        "x",
        Math.max(medGapY, minGapX),
        scale,
      );
      if (macroCols.length >= 2 && macroCols.length < xCols.length) {
        emitColumnsAsFlexRow(macroCols, parentBox, fallbackParentId);
        return;
      }
    }

    if (maxGapY > Math.max(medGapX, minGapY) + 8) {
      const macroRows = splitByLargeGaps(
        items,
        "y",
        Math.max(medGapX, minGapY),
        scale,
      );
      if (macroRows.length >= 2 && macroRows.length < yBands.length) {
        emitRowsAsColumnStack(macroRows, parentBox, fallbackParentId);
        return;
      }
    }

    const multiElementColsCount = xCols.filter((c) => c.length >= 2).length;
    if (xHasUniform || multiElementColsCount >= 2) {
      emitGroupsInDirection(xCols, "row", parentBox, fallbackParentId);
      return;
    }

    emitGroupsInDirection(yBands, "column", parentBox, fallbackParentId);
  }

  for (const item of initialItems) {
    generatedBoxes.push(item.box);
  }

  layoutSubtree(rootItems, null);

  return generatedBoxes;
}
