import type { HtmlNode } from "@/types/HtmlNode";

export interface WireframeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tag?: string;
}

interface IntermediateNode {
  box: WireframeBox;
  children: IntermediateNode[];
  parent: IntermediateNode | null;
}

/**
 * 🔹 Проверка геометрического включения: лежит ли коробка B внутри коробки A
 */
function isContained(
  inner: WireframeBox,
  outer: WireframeBox,
  tolerance = 3,
): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

/**
 * 🔹 Компиляция рамок в чистые ноды без разметки, без классов и без стилей
 */
export function compileWireframeBoxesToTree(boxes: WireframeBox[]): HtmlNode[] {
  if (boxes.length === 0) return [];

  const nodes: IntermediateNode[] = boxes.map((box) => ({
    box,
    children: [],
    parent: null,
  }));

  // Сортировка по площади (внешние контейнеры первыми)
  nodes.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);

  // Определение геометрической вложенности
  for (let i = 0; i < nodes.length; i++) {
    const current = nodes[i];
    let bestParent: IntermediateNode | null = null;

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const candidate = nodes[j];
      if (isContained(current.box, candidate.box)) {
        if (
          !bestParent ||
          candidate.box.width * candidate.box.height <
            bestParent.box.width * bestParent.box.height
        ) {
          bestParent = candidate;
        }
      }
    }

    if (bestParent) {
      current.parent = bestParent;
      bestParent.children.push(current);
    }
  }

  const rootNodes = nodes.filter((n) => n.parent === null);

  function convertToHtmlNode(node: IntermediateNode): HtmlNode {
    // Естественный порядок следования в DOM (сверху вниз, слева направо)
    node.children.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);

    return {
      tag: node.box.tag ? node.box.tag : "",
      class: "",
      style: "",
      children: node.children.map(convertToHtmlNode),
      _key: `box_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  return rootNodes.map(convertToHtmlNode);
}
