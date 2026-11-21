import type { HtmlNode } from "@/types/HtmlNode";
import type {
  AiLayoutGroup,
  AiLayoutInputNode,
} from "@/app/plaza/actions/generateWireframeLayoutAction";
import {
  computeBoundingRect,
  isContained,
  isSameBounds,
  mergeInlineStyles,
  type LayoutRect,
  type OverlayMetrics,
  type RawFigmaNodeEntry,
  type WireframeBox,
} from "./wireframeTypes";
import {
  collectFigmaNodesFromTree,
  extractCssFromSvgNode,
} from "./wireframeFigmaCollector";

interface PreparedFigmaContext {
  entries: RawFigmaNodeEntry[];
  leafEntries: RawFigmaNodeEntry[];
  containerEntries: RawFigmaNodeEntry[];
  absorbedSvgByContainerKey: Map<
    string,
    { css: string; consumedKeys: string[] }
  >;
  absorbedSvgKeys: Set<string>;
  scale: number;
  originX: number;
  originY: number;
  usePageCoords: boolean;
  toScreenRect: (e: RawFigmaNodeEntry) => LayoutRect;
}

function prepareFigmaContext(
  tree: HtmlNode[],
  options: {
    containerWidth: number;
    overlayMetrics?: OverlayMetrics;
    scaleMode?: "auto" | "1x" | "2x";
    existingDonorKeys?: Set<string>;
  },
): PreparedFigmaContext | null {
  const entries = collectFigmaNodesFromTree(tree).filter(
    (e) => !options.existingDonorKeys?.has(e.key),
  );
  if (entries.length === 0) return null;

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

  const tol = Math.max(4, Math.round(4 * scale));
  const absorbedSvgKeys = new Set<string>();
  const absorbedSvgByContainerKey = new Map<
    string,
    { css: string; consumedKeys: string[] }
  >();
  const containerEntries = entries.filter((e) => e.isContainerNode);

  // Определяем фоновые SVG-прямоугольники (подложки карточек и секций)
  for (const item of entries) {
    if (!item.isSvgShape) continue;
    const itemRect = toScreenRect(item);

    const matchingContainer = containerEntries.find((other) =>
      isSameBounds(itemRect, toScreenRect(other), tol),
    );
    const extractedCss = extractCssFromSvgNode(item.node);

    if (matchingContainer) {
      const prev = absorbedSvgByContainerKey.get(matchingContainer.key) || {
        css: "",
        consumedKeys: [],
      };
      absorbedSvgByContainerKey.set(matchingContainer.key, {
        css: mergeInlineStyles(prev.css, extractedCss),
        consumedKeys: [...prev.consumedKeys, item.key],
      });
      absorbedSvgKeys.add(item.key);
      continue;
    }

    // Если это SVG-фон карточки (охватывает другие листовые элементы) — превращаем его в стили контейнера
    const containedCount = entries.filter((other) => {
      if (
        other === item ||
        other.isContainerNode ||
        absorbedSvgKeys.has(other.key)
      ) {
        return false;
      }
      const otherRect = toScreenRect(other);
      return (
        isContained(otherRect, itemRect, tol) &&
        otherRect.width * otherRect.height <
          itemRect.width * itemRect.height * 0.9
      );
    }).length;

    if (containedCount >= 1) {
      const prev = absorbedSvgByContainerKey.get(item.key) || {
        css: "",
        consumedKeys: [],
      };
      absorbedSvgByContainerKey.set(item.key, {
        css: mergeInlineStyles(prev.css, extractedCss),
        consumedKeys: [...prev.consumedKeys, item.key],
      });
      absorbedSvgKeys.add(item.key);
    }
  }

  const leafEntries = entries.filter(
    (e) => !e.isContainerNode && !absorbedSvgKeys.has(e.key),
  );

  return {
    entries,
    leafEntries,
    containerEntries,
    absorbedSvgByContainerKey,
    absorbedSvgKeys,
    scale,
    originX,
    originY,
    usePageCoords,
    toScreenRect,
  };
}

function getTextPreview(node: HtmlNode): string {
  if (node.text && node.text.trim()) {
    return node.text.trim().slice(0, 60);
  }
  if (Array.isArray(node.children)) {
    for (const ch of node.children) {
      const t = getTextPreview(ch);
      if (t) return t;
    }
  }
  return "";
}

export function prepareAiLayoutInput(
  tree: HtmlNode[],
  options: {
    containerWidth: number;
    overlayMetrics?: OverlayMetrics;
    scaleMode?: "auto" | "1x" | "2x";
    existingDonorKeys?: Set<string>;
  },
): AiLayoutInputNode[] {
  const ctx = prepareFigmaContext(tree, options);
  if (!ctx) return [];

  return ctx.leafEntries.map((e) => {
    const rawX = ctx.usePageCoords ? e.pageX : e.x;
    const rawY = ctx.usePageCoords ? e.pageY : e.y;
    const role: AiLayoutInputNode["role"] = e.isImageBlock
      ? "image"
      : e.isSvgShape
        ? "svg"
        : e.tag === "a" || e.tag === "button"
          ? "action"
          : "text";

    const fontClass = (e.node.class || "")
      .split(/\s+/)
      .find((c) => c.startsWith("font-"));

    return {
      id: e.key,
      tag: e.isImageBlock ? "img" : e.isSvgShape ? "svg" : e.tag || "p",
      role,
      text:
        role === "text" || role === "action"
          ? getTextPreview(e.node)
          : undefined,
      fontClass,
      x: Math.round(rawX),
      y: Math.round(rawY),
      w: Math.round(e.width),
      h: Math.round(e.height),
    };
  });
}

export function buildWireframeBoxesFromAiPlan(
  tree: HtmlNode[],
  aiGroups: AiLayoutGroup[],
  options: {
    containerWidth: number;
    overlayMetrics?: OverlayMetrics;
    scaleMode?: "auto" | "1x" | "2x";
    existingDonorKeys?: Set<string>;
  },
): WireframeBox[] {
  const ctx = prepareFigmaContext(tree, options);
  if (!ctx) return [];

  const stamp = Date.now();
  let seq = 0;
  const nextId = (prefix: string) =>
    `${prefix}_${stamp}_${seq++}_${Math.random().toString(36).substring(2, 6)}`;

  const leafEntryByKey = new Map<string, RawFigmaNodeEntry>();
  for (const e of ctx.leafEntries) {
    leafEntryByKey.set(e.key, e);
  }

  // 1. Создаём WireframeBox для всех листовых элементов
  const leafBoxByKey = new Map<string, WireframeBox>();
  for (const e of ctx.leafEntries) {
    const rect = ctx.toScreenRect(e);
    leafBoxByKey.set(e.key, {
      id: nextId("ai_leaf"),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale: ctx.scale,
      tag: "",
      donorKey: e.key,
      sortPriority: 0,
    });
  }

  // 2. Создаём маппинг ID групп от ИИ в уникальные WireframeBox ID
  const groupIdMap = new Map<string, string>();
  const validGroups: AiLayoutGroup[] = [];
  for (const g of aiGroups) {
    if (!g || !g.id || groupIdMap.has(g.id)) continue;
    groupIdMap.set(g.id, nextId(`ai_${g.tag || "box"}`));
    validGroups.push(g);
  }

  const assignedLeafKeys = new Set<string>();
  const groupBoxByRealId = new Map<string, WireframeBox>();
  const childrenRectsByGroupId = new Map<string, LayoutRect[]>();

  const pushRectToGroup = (groupId: string, rect: LayoutRect) => {
    const arr = childrenRectsByGroupId.get(groupId) || [];
    arr.push(rect);
    childrenRectsByGroupId.set(groupId, arr);
  };

  for (const g of validGroups) {
    const realId = groupIdMap.get(g.id)!;
    const mappedParentId =
      g.parentId && groupIdMap.has(g.parentId) && g.parentId !== g.id
        ? groupIdMap.get(g.parentId)
        : undefined;

    let style = "";
    if (g.direction === "row") {
      style = "display: flex; flex-direction: row; align-items: flex-start;";
    } else if (g.direction === "column") {
      style = "display: flex; flex-direction: column;";
    } else if (g.direction === "wrap") {
      style =
        "display: flex; flex-direction: row; flex-wrap: wrap; align-items: stretch; gap: 16px;";
    }

    const isUl = g.tag === "ul";
    const isLi = g.tag === "li";
    const sortPriority =
      g.tag === "section" || g.tag === "header" || g.tag === "footer"
        ? 3
        : isLi
          ? 1
          : 2;

    const groupBox: WireframeBox = {
      id: realId,
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      scale: ctx.scale,
      tag: g.tag || "div",
      style: style || undefined,
      sortPriority,
      parentId: mappedParentId,
      listItemPreset:
        isUl && g.listPreset && g.listPreset !== "none"
          ? g.listPreset
          : undefined,
    };

    if (Array.isArray(g.childDonorIds)) {
      for (const donorId of g.childDonorIds) {
        if (assignedLeafKeys.has(donorId)) continue;
        const leafBox = leafBoxByKey.get(donorId);
        if (!leafBox) continue;

        assignedLeafKeys.add(donorId);
        leafBox.parentId = realId;
        pushRectToGroup(realId, {
          x: leafBox.x,
          y: leafBox.y,
          width: leafBox.width,
          height: leafBox.height,
        });
      }
    }

    groupBoxByRealId.set(realId, groupBox);
  }

  // 3. Страховка от пропущенных нод: если ИИ пропустил какой-то лист, прикрепляем к ближайшему родителю
  const groupBoxesList = Array.from(groupBoxByRealId.values());
  const rootGroups = groupBoxesList.filter((b) => !b.parentId);

  for (const [key, leafBox] of leafBoxByKey.entries()) {
    if (assignedLeafKeys.has(key)) continue;
    assignedLeafKeys.add(key);
    if (rootGroups.length === 1) {
      leafBox.parentId = rootGroups[0].id;
      pushRectToGroup(rootGroups[0].id, {
        x: leafBox.x,
        y: leafBox.y,
        width: leafBox.width,
        height: leafBox.height,
      });
    }
  }

  // 4. Вычисляем bounding rect для каждой группы снизу вверх
  const childrenMap = new Map<string, WireframeBox[]>();
  for (const gb of groupBoxesList) {
    if (gb.parentId) {
      const list = childrenMap.get(gb.parentId) || [];
      list.push(gb);
      childrenMap.set(gb.parentId, list);
    }
  }

  const resolvedBounds = new Map<string, LayoutRect>();
  const visiting = new Set<string>();

  function computeGroupBounds(groupId: string): LayoutRect | null {
    if (resolvedBounds.has(groupId)) return resolvedBounds.get(groupId)!;
    if (visiting.has(groupId)) return null;
    visiting.add(groupId);

    const rects: LayoutRect[] = [
      ...(childrenRectsByGroupId.get(groupId) || []),
    ];
    const childGroups = childrenMap.get(groupId) || [];
    for (const cg of childGroups) {
      const r = computeGroupBounds(cg.id);
      if (r) rects.push(r);
    }

    visiting.delete(groupId);
    if (rects.length === 0) return null;

    const bbox = computeBoundingRect(rects.map((rect) => ({ rect })));
    resolvedBounds.set(groupId, bbox);

    const gb = groupBoxByRealId.get(groupId);
    if (gb) {
      gb.x = bbox.x;
      gb.y = bbox.y;
      gb.width = bbox.width;
      gb.height = bbox.height;
    }
    return bbox;
  }

  for (const gb of groupBoxesList) {
    computeGroupBounds(gb.id);
  }

  // Отфильтровываем пустые группы, в которые ничего не попало
  const nonEmptyGroupBoxes = groupBoxesList.filter((gb) =>
    resolvedBounds.has(gb.id),
  );

  // 5. Подтягиваем стили фоновых SVG-подложек и помечаем все старые контейнеры на удаление (consumedDonorKeys)
  const tol = Math.max(4, Math.round(4 * ctx.scale));
  for (const [key, svgInfo] of ctx.absorbedSvgByContainerKey.entries()) {
    const entry = ctx.entries.find((e) => e.key === key);
    if (!entry) continue;
    const entryRect = ctx.toScreenRect(entry);

    const matchingGroup = nonEmptyGroupBoxes.find((gb) =>
      isSameBounds(entryRect, gb, tol),
    );
    if (matchingGroup) {
      if (svgInfo.css) {
        matchingGroup.style = mergeInlineStyles(
          matchingGroup.style,
          svgInfo.css,
        );
      }
      matchingGroup.consumedDonorKeys = [
        ...(matchingGroup.consumedDonorKeys || []),
        ...svgInfo.consumedKeys,
      ];
    } else if (nonEmptyGroupBoxes.length > 0) {
      nonEmptyGroupBoxes[0].consumedDonorKeys = [
        ...(nonEmptyGroupBoxes[0].consumedDonorKeys || []),
        ...svgInfo.consumedKeys,
      ];
    }
  }

  // Все исходные Figma-контейнеры тоже должны быть удалены из дерева при Commit
  const allContainerKeys = ctx.containerEntries.map((c) => c.key);
  if (allContainerKeys.length > 0) {
    const anchorTarget =
      nonEmptyGroupBoxes.find((b) => !b.parentId) ||
      nonEmptyGroupBoxes[0] ||
      Array.from(leafBoxByKey.values())[0];

    if (anchorTarget) {
      anchorTarget.consumedDonorKeys = [
        ...(anchorTarget.consumedDonorKeys || []),
        ...allContainerKeys,
      ];
    }
  }

  // Если у <ul> дочерние <li> лежат горизонтально в одну линию и у них выровненные центры,
  // уточняем align-items / gap у <ul> и у <li> с 2+ детьми в строку
  for (const gb of nonEmptyGroupBoxes) {
    if (gb.tag === "li") {
      const leafKids = Array.from(leafBoxByKey.values()).filter(
        (lb) => lb.parentId === gb.id,
      );
      if (leafKids.length >= 2) {
        const yOverlap = leafKids.every((k) => {
          const first = leafKids[0];
          const overlap =
            Math.min(first.y + first.height, k.y + k.height) -
            Math.max(first.y, k.y);
          return overlap > 2;
        });
        if (yOverlap) {
          gb.style = mergeInlineStyles(
            gb.style,
            "display: flex; flex-direction: row; align-items: center;",
          );
        }
      }
    }
  }

  return [...nonEmptyGroupBoxes, ...Array.from(leafBoxByKey.values())];
}
