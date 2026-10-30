"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  moveNodePosition,
  findNodeByKey,
  isDescendant,
  duplicateNodeInTree,
} from "@/lib/htmlTree";

export interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside";
}

interface UseCanvasDnDOptions {
  currentJsonRef: React.MutableRefObject<HtmlNode[]>;
  persist: (next: HtmlNode[]) => Promise<void>;
}

export function useCanvasDnD({ currentJsonRef, persist }: UseCanvasDnDOptions) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const draggedKeyRef = useRef<string | null>(null);

  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  dropTargetRef.current = dropTarget;

  const [dragMousePos, setDragMousePos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const potentialDragKeyRef = useRef<string | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef<boolean>(false);

  // Инициирование перетаскивания при нажатии на карточку
  const handlePointerDownNode = useCallback(
    (e: React.PointerEvent, key: string) => {
      if (e.button !== 0) return;
      potentialDragKeyRef.current = key;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      hasDraggedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (potentialDragKeyRef.current && dragStartPosRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 4) {
          draggedKeyRef.current = potentialDragKeyRef.current;
          setDraggedKey(potentialDragKeyRef.current);
          potentialDragKeyRef.current = null;
          hasDraggedRef.current = true;
          document.body.style.cursor = "default";
        }
      }

      const activeDragKey = draggedKeyRef.current;
      if (!activeDragKey) return;

      setDragMousePos({ x: e.clientX, y: e.clientY });

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length === 0) {
        dropTargetRef.current = null;
        setDropTarget(null);
        return;
      }

      // 1. Попадание в зазор между нодами (DropGap)
      const gapEl = elements
        .map((el) => el.closest("[data-gap-key]"))
        .find(Boolean) as HTMLElement | undefined;
      if (gapEl) {
        const key = gapEl.getAttribute("data-gap-key")!;
        const position = gapEl.getAttribute("data-gap-pos") as
          "before" | "after";
        if (key === activeDragKey) {
          dropTargetRef.current = null;
          setDropTarget(null);
          return;
        }
        const nextTarget: DropTarget = { key, position };
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
        return;
      }

      // 2. Попадание на карточку ноды (NodeCard)
      const cardEl = elements
        .map((el) => el.closest("[data-node-key]"))
        .find(Boolean) as HTMLElement | undefined;
      if (cardEl) {
        const key = cardEl.getAttribute("data-node-key")!;
        const isParentRow = cardEl.getAttribute("data-is-row") === "true";

        if (key === activeDragKey) {
          const nextTarget: DropTarget = {
            key: activeDragKey,
            position: "self",
          };
          dropTargetRef.current = nextTarget;
          setDropTarget(nextTarget);
          return;
        }

        let sourceNode: HtmlNode | null = null;
        for (const root of currentJsonRef.current) {
          const found = findNodeByKey(root, activeDragKey);
          if (found) {
            sourceNode = found;
            break;
          }
        }
        if (sourceNode && isDescendant(sourceNode, key)) {
          dropTargetRef.current = null;
          setDropTarget(null);
          return;
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

        const nextTarget: DropTarget = { key, position };
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
        return;
      }

      // 3. Попадание в свободную область холста
      const workspaceEl = elements
        .map((el) => el.closest(".plaza-workspace"))
        .find(Boolean);
      if (workspaceEl && currentJsonRef.current.length > 0) {
        const lastRoot =
          currentJsonRef.current[currentJsonRef.current.length - 1];
        const nextTarget: DropTarget = {
          key: lastRoot._key || "",
          position: "after",
        };
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
        return;
      }

      dropTargetRef.current = null;
      setDropTarget(null);
    };

    const handlePointerUp = async () => {
      const activeDragKey = draggedKeyRef.current;
      const target = dropTargetRef.current;

      draggedKeyRef.current = null;
      setDraggedKey(null);
      dropTargetRef.current = null;
      setDropTarget(null);
      setDragMousePos(null);
      potentialDragKeyRef.current = null;
      dragStartPosRef.current = null;

      if (hasDraggedRef.current) {
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 50);
      }

      if (activeDragKey && target && target.key) {
        if (target.position === "self") {
          const updated = duplicateNodeInTree(
            currentJsonRef.current,
            activeDragKey,
          );
          await persist(updated);
        } else {
          const updated = moveNodePosition(
            currentJsonRef.current,
            activeDragKey,
            target.key,
            target.position,
          );
          await persist(updated);
        }
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
  }, [currentJsonRef, persist]);

  // Находим объект перетаскиваемой ноды для отображения "призрака"
  let draggedNode: HtmlNode | null = null;
  if (draggedKey) {
    for (const r of currentJsonRef.current) {
      const f = findNodeByKey(r, draggedKey);
      if (f) {
        draggedNode = f;
        break;
      }
    }
  }

  return {
    draggedKey,
    dropTarget,
    dragMousePos,
    draggedNode,
    hasDraggedRef,
    handlePointerDownNode,
  };
}
