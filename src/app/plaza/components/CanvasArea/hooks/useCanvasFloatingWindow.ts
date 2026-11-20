"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import {
  clampFloatingPosition,
  clampFloatingSize,
  clampGraphZoom,
  computeInitialFloatingBounds,
  getHeaderOffset,
  MIN_FLOATING_HEIGHT,
  MIN_FLOATING_WIDTH,
  type FloatingPos,
  type FloatingSize,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";

export function useCanvasFloatingWindow(isCanvasFloating: boolean) {
  const workspaceRef = useRef<HTMLDivElement>(null);

  const [isInteractingWindow, setIsInteractingWindow] = useState(false);
  const [graphZoom, setGraphZoom] = useState<number>(1);
  const [floatingPos, setFloatingPos] = useState<FloatingPos>({
    x: 208,
    y: 56,
  });
  const [floatingSize, setFloatingSize] = useState<FloatingSize>({
    w: 720,
    h: 460,
  });

  const posRef = useRef<FloatingPos>({ x: 208, y: 56 });
  const sizeRef = useRef<FloatingSize>({ w: 720, h: 460 });
  const hasManualMoveRef = useRef(false);

  const dragWindowRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    minTop: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  const resizeWindowRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    maxW: number;
    maxH: number;
  } | null>(null);

  // Зум графа колёсиком мыши при зажатом Ctrl / Cmd
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setGraphZoom((prev) =>
        clampGraphZoom(prev + (e.deltaY < 0 ? 0.1 : -0.1)),
      );
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isCanvasFloating]);

  // Стартовая позиция и размеры при подъёме канваса поверх превью
  useEffect(() => {
    if (!isCanvasFloating) {
      hasManualMoveRef.current = false;
      dragWindowRef.current = null;
      resizeWindowRef.current = null;
      setIsInteractingWindow(false);
      return;
    }

    const isAsideFloating = useCanvasStore.getState().isAsideFloating;
    const { pos, size } = computeInitialFloatingBounds(
      window.innerWidth,
      window.innerHeight,
      isAsideFloating,
    );

    posRef.current = pos;
    sizeRef.current = size;
    setFloatingPos(pos);
    setFloatingSize(size);

    const updateTopOnScroll = () => {
      if (hasManualMoveRef.current) return;
      const nextY = getHeaderOffset();
      posRef.current = { ...posRef.current, y: nextY };
      setFloatingPos({ ...posRef.current });
    };

    window.addEventListener("resize", updateTopOnScroll);
    window.addEventListener("scroll", updateTopOnScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", updateTopOnScroll);
      window.removeEventListener("scroll", updateTopOnScroll);
    };
  }, [isCanvasFloating]);

  const handleWindowDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isCanvasFloating) return;
      if (
        (e.target as HTMLElement).closest("button, a, input, select, textarea")
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const minTop = getHeaderOffset();
      const maxX = Math.max(8, window.innerWidth - 240);
      const maxY = Math.max(minTop, window.innerHeight - 80);

      hasManualMoveRef.current = true;
      dragWindowRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: posRef.current.x,
        origY: posRef.current.y,
        minTop,
        maxX,
        maxY,
      };

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture is unsupported
      }
      setIsInteractingWindow(true);
    },
    [isCanvasFloating],
  );

  const handleWindowDragMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragWindowRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const next = clampFloatingPosition(
        drag.origX + dx,
        drag.origY + dy,
        drag.minTop,
        drag.maxX,
        drag.maxY,
      );

      posRef.current = next;

      if (workspaceRef.current) {
        workspaceRef.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      }
    },
    [],
  );

  const handleWindowDragEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragWindowRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      dragWindowRef.current = null;
      setIsInteractingWindow(false);

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }

      setFloatingPos({ ...posRef.current });
    },
    [],
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isCanvasFloating) return;
      e.preventDefault();
      e.stopPropagation();

      hasManualMoveRef.current = true;
      resizeWindowRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origW: sizeRef.current.w,
        origH: sizeRef.current.h,
        maxW: Math.max(
          MIN_FLOATING_WIDTH,
          window.innerWidth - posRef.current.x - 8,
        ),
        maxH: Math.max(
          MIN_FLOATING_HEIGHT,
          window.innerHeight - posRef.current.y - 8,
        ),
      };

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsInteractingWindow(true);
    },
    [isCanvasFloating],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const res = resizeWindowRef.current;
      if (!res || res.pointerId !== e.pointerId) return;

      const dx = e.clientX - res.startX;
      const dy = e.clientY - res.startY;
      const next = clampFloatingSize(
        res.origW + dx,
        res.origH + dy,
        res.maxW,
        res.maxH,
      );

      sizeRef.current = next;

      if (workspaceRef.current) {
        workspaceRef.current.style.width = `${next.w}px`;
        workspaceRef.current.style.height = `${next.h}px`;
      }
    },
    [],
  );

  const handleResizeEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const res = resizeWindowRef.current;
      if (!res || res.pointerId !== e.pointerId) return;

      resizeWindowRef.current = null;
      setIsInteractingWindow(false);

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }

      setFloatingSize({ ...sizeRef.current });
    },
    [],
  );

  const zoomOut = useCallback(
    () => setGraphZoom((z) => clampGraphZoom(z - 0.2)),
    [],
  );
  const zoomIn = useCallback(
    () => setGraphZoom((z) => clampGraphZoom(z + 0.2)),
    [],
  );
  const resetZoom = useCallback(() => setGraphZoom(1), []);

  return {
    workspaceRef,
    graphZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    isInteractingWindow,
    floatingPos,
    floatingSize,
    handleWindowDragStart,
    handleWindowDragMove,
    handleWindowDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
}
