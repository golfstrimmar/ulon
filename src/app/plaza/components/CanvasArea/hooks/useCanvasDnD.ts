"use client";

import { useEffect, useRef } from "react";
import {
  normalizeSelectedKeys,
  findNodeInTree,
  collectAllDescendantKeys,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { isDescendant } from "@/lib/htmlTree";
import {
  useCanvasStore,
  type DropTarget,
} from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

export type { DropTarget };

export function useCanvasDnD() {
  const hasDraggedRef = useRef(false);
  const invalidDropKeysRef = useRef<Set<string>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // 🚀 Вычисление DropTarget под курсором с частотой обновления дисплея (RAF)
    const updateDropState = (clientX: number, clientY: number) => {
      const activeKeys = useCanvasStore.getState().draggedKeys;
      if (activeKeys.length === 0) return;

      // 1. Обновляем координаты для призрака
      useCanvasStore.getState().setDragMousePos({ x: clientX, y: clientY });

      // 2. elementsFromPoint
      const elements = document.elementsFromPoint(clientX, clientY);
      if (!elements || elements.length === 0) {
        useCanvasStore.getState().setDropTarget(null);
        return;
      }

      // 2.1. Попадание в зазор между нодами (DropGap)
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

      // 2.2. Попадание на карточку ноды (NodeCard)
      const cardEl = elements
        .map((el) => el.closest("[data-node-key]"))
        .find(Boolean) as HTMLElement | undefined;
      if (cardEl) {
        const key = cardEl.getAttribute("data-node-key")!;
        const isParentRow = cardEl.getAttribute("data-is-row") === "true";

        // Попадание на одну из перетаскиваемых нод -> "self" (дублирование)
        if (activeKeys.includes(key)) {
          useCanvasStore.getState().setDropTarget({ key, position: "self" });
          return;
        }

        // 🚀 O(1) проверка через кэш: запрет сброса внутрь перетаскиваемых нод и их детей
        if (invalidDropKeysRef.current.has(key)) {
          useCanvasStore.getState().setDropTarget(null);
          return;
        }

        const rect = cardEl.getBoundingClientRect();
        let position: "before" | "inside" | "after" = "inside";

        if (isParentRow) {
          const relX = (clientX - rect.left) / rect.width;
          if (relX < 0.25) position = "before";
          else if (relX > 0.75) position = "after";
          else position = "inside";
        } else {
          const relY = (clientY - rect.top) / rect.height;
          if (relY < 0.25) position = "before";
          else if (relY > 0.75) position = "after";
          else position = "inside";
        }

        useCanvasStore.getState().setDropTarget({ key, position });
        return;
      }

      // 2.3. Попадание в свободную область холста
      const workspaceEl = elements
        .map((el) => el.closest(".plaza-workspace"))
        .find(Boolean);
      const currentTree = useCanvasStore.getState().currentJson;
      if (workspaceEl && currentTree.length > 0) {
        const lastRoot = currentTree[currentTree.length - 1];
        useCanvasStore.getState().setDropTarget({
          key: lastRoot._key || "",
          position: "after",
        });
        return;
      }

      useCanvasStore.getState().setDropTarget(null);
    };

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
            state.clearSelection();
            keysToDrag = [startKey];
          }

          // 🚀 Кэшируем всех потомков перемещаемых нод один раз на старте драга
          const invalidKeys = new Set<string>(keysToDrag);
          for (const k of keysToDrag) {
            const node = findNodeInTree(currentJson, k);
            if (node) {
              collectAllDescendantKeys(node).forEach((id) => invalidKeys.add(id));
            }
          }
          invalidDropKeysRef.current = invalidKeys;

          state.setPotentialDrag(null);
          state.setDraggedKeys(keysToDrag);
          hasDraggedRef.current = true;
          document.body.style.cursor = "default";
        }
      }

      // 🚀 2. Дросселирование через requestAnimationFrame
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (lastMousePosRef.current) {
            updateDropState(
              lastMousePosRef.current.x,
              lastMousePosRef.current.y,
            );
          }
        });
      }
    };

    const handlePointerUp = async () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      invalidDropKeysRef.current = new Set();

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
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  return {
    hasDraggedRef,
  };
}
