"use client";

import { useCallback } from "react";
import { normalizeSelectedKeys } from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

interface UseCanvasMarqueeOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useCanvasMarquee({ containerRef }: UseCanvasMarqueeOptions) {
  const handleMarqueePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Если клик пришелся на саму карточку, кнопку или поле ввода — рамку НЕ запускаем
      if (
        target.closest("[data-node-key]") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea")
      ) {
        return;
      }

      // Новое зажатие на пустом месте — обнуляем старое выделение
      useCanvasStore.getState().clearSelection();

      const startX = e.clientX;
      const startY = e.clientY;

      const initialBox = {
        startX,
        startY,
        currentX: startX,
        currentY: startY,
      };
      useCanvasStore.getState().setSelectionBox(initialBox);

      const handlePointerMove = (moveEvt: PointerEvent) => {
        const curX = moveEvt.clientX;
        const curY = moveEvt.clientY;

        const updatedBox = {
          startX,
          startY,
          currentX: curX,
          currentY: curY,
        };
        useCanvasStore.getState().setSelectionBox(updatedBox);

        // Проверяем минимальный размер рамки (больше 4px)
        if (Math.hypot(curX - startX, curY - startY) < 4) {
          return;
        }

        const boxL = Math.min(startX, curX);
        const boxR = Math.max(startX, curX);
        const boxT = Math.min(startY, curY);
        const boxB = Math.max(startY, curY);

        const container = containerRef.current || document;
        const cards = container.querySelectorAll<HTMLElement>("[data-node-key]");
        const hitKeys = new Set<string>();

        cards.forEach((card) => {
          const headerEl = card.querySelector<HTMLElement>("[data-node-header]");
          const targetEl = headerEl || card;
          const r = targetEl.getBoundingClientRect();

          // Проверка пересечения двух прямоугольников (AABB)
          const intersects =
            r.left < boxR && r.right > boxL && r.top < boxB && r.bottom > boxT;

          if (intersects) {
            const key = card.getAttribute("data-node-key");
            if (key) hitKeys.add(key);
          }
        });

        // Нормализация: законченные ноды (дети отсекаются, если выделен их родитель)
        const currentTree = useCanvasStore.getState().currentJson;
        const normalized = normalizeSelectedKeys(currentTree, hitKeys);
        useCanvasStore.getState().setSelectedKeys(new Set(normalized));
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        useCanvasStore.getState().setSelectionBox(null);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [containerRef],
  );

  return {
    handleMarqueePointerDown,
  };
}
