"use client";

import { useEffect, useRef } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { findNodeByKey, isDescendant } from "@/lib/htmlTree";
import {
  normalizeSelectedKeys,
  findNodeInTree,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import {
  useCanvasStore,
  type DropTarget,
} from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

export type { DropTarget };

export function useCanvasDnD() {
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = useCanvasStore.getState();
      const { potentialDrag, selectedKeys, currentJson } = state;

      // 1. Проверяем порог начала перетаскивания (4px)
      if (potentialDrag) {
        const dx = e.clientX - potentialDrag.startX;
        const dy = e.clientY - potentialDrag.startY;
        if (Math.hypot(dx, dy) > 4) {
          const startKey = potentialDrag.key;
          let keysToDrag: string[];

          // Проверяем: входит ли startKey в группу выделения
          const isInSelection =
            selectedKeys.has(startKey) ||
            Array.from(selectedKeys).some((selKey) => {
              const pNode = findNodeInTree(currentJson, selKey);
              return pNode && isDescendant(pNode, startKey);
            });

          if (isInSelection) {
            const normalized = normalizeSelectedKeys(currentJson, selectedKeys);
            keysToDrag = normalized.length > 0 ? normalized : [startKey];
          } else {
            // Если узел не выделен — сбрасываем старую группу и тянем только его
            state.clearSelection();
            keysToDrag = [startKey];
          }

          state.setPotentialDrag(null);
          state.setDraggedKeys(keysToDrag);
          hasDraggedRef.current = true;
          document.body.style.cursor = "default";
        }
      }

      const activeKeys = useCanvasStore.getState().draggedKeys;
      if (activeKeys.length === 0) return;

      // 2. Обновляем координаты курсора
      useCanvasStore.getState().setDragMousePos({ x: e.clientX, y: e.clientY });

      // 3. Вычисляем DropTarget под курсором
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length === 0) {
        useCanvasStore.getState().setDropTarget(null);
        return;
      }

      // 3.1. Попадание в зазор между нодами (DropGap)
      const gapEl = elements
        .map((el) => el.closest("[data-gap-key]"))
        .find(Boolean) as HTMLElement | undefined;
      if (gapEl) {
        const key = gapEl.getAttribute("data-gap-key")!;
        const position = gapEl.getAttribute("data-gap-pos") as "before" | "after";

        if (activeKeys.includes(key)) {
          useCanvasStore.getState().setDropTarget(null);
          return;
        }

        useCanvasStore.getState().setDropTarget({ key, position });
        return;
      }

      // 3.2. Попадание на карточку ноды (NodeCard)
      const cardEl = elements
        .map((el) => el.closest("[data-node-key]"))
        .find(Boolean) as HTMLElement | undefined;
      if (cardEl) {
        const key = cardEl.getAttribute("data-node-key")!;
        const isParentRow = cardEl.getAttribute("data-is-row") === "true";

        // Попадание на себя -> "self" (дублирование)
        if (activeKeys.includes(key)) {
          useCanvasStore.getState().setDropTarget({ key, position: "self" });
          return;
        }

        // Запрет сброса внутрь любого узла из перемещаемой группы или их потомков
        for (const dragKey of activeKeys) {
          let sourceNode: HtmlNode | null = null;
          for (const root of currentJson) {
            const found = findNodeByKey(root, dragKey);
            if (found) {
              sourceNode = found;
              break;
            }
          }
          if (sourceNode && isDescendant(sourceNode, key)) {
            useCanvasStore.getState().setDropTarget(null);
            return;
          }
        }

        const rect = cardEl.getBoundingClientRect();
        let position: "before" | "inside" | "after" = "inside";

        if (isParentRow) {
          const relX = (e.clientX - rect.left) / rect.width;
          if (relX < 0.25) position = "before";
          else if (relX > 0.75) position = "after";
          else position = "inside";
        } else {
          const relY = (e.clientY - rect.top) / rect.height;
          if (relY < 0.25) position = "before";
          else if (relY > 0.75) position = "after";
          else position = "inside";
        }

        useCanvasStore.getState().setDropTarget({ key, position });
        return;
      }

      // 3.3. Попадание в свободную область холста
      const workspaceEl = elements
        .map((el) => el.closest(".plaza-workspace"))
        .find(Boolean);
      if (workspaceEl && currentJson.length > 0) {
        const lastRoot = currentJson[currentJson.length - 1];
        useCanvasStore.getState().setDropTarget({
          key: lastRoot._key || "",
          position: "after",
        });
        return;
      }

      useCanvasStore.getState().setDropTarget(null);
    };

    const handlePointerUp = async () => {
      const state = useCanvasStore.getState();
      if (state.potentialDrag) {
        state.setPotentialDrag(null);
      }

      if (state.draggedKeys.length > 0) {
        await state.commitDrop();
      }

      if (hasDraggedRef.current) {
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 50);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  return {
    hasDraggedRef,
  };
}
