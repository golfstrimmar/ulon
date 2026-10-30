"use client";

import React, { createContext, useContext } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import type { DropTarget } from "@/app/plaza/components/CanvasArea/hooks/useCanvasDnD";

export interface CanvasTreeContextValue {
  currentJson: HtmlNode[];
  persist: (next: HtmlNode[]) => Promise<void>;
  clickedKey: string | null;
  setClickedKey: (key: string | null) => void;
  hoveredKey: string | null;
  setHoveredKey: (key: string | null) => void;
  collapsedKeys: Set<string>;
  toggleCollapseKey: (key: string) => void;
  deleteNode: (key: string) => Promise<void>;
  startDrag: (e: React.PointerEvent, key: string) => void;
  draggedKey: string | null;
  dropTarget: DropTarget | null;
  hasDraggedRef: React.MutableRefObject<boolean>;
}

const CanvasTreeContext = createContext<CanvasTreeContextValue | null>(null);

export function CanvasTreeProvider({
  value,
  children,
}: {
  value: CanvasTreeContextValue;
  children: React.ReactNode;
}) {
  return (
    <CanvasTreeContext.Provider value={value}>
      {children}
    </CanvasTreeContext.Provider>
  );
}

export function useCanvasTreeContext() {
  const ctx = useContext(CanvasTreeContext);
  if (!ctx) {
    throw new Error(
      "useCanvasTreeContext must be used within CanvasTreeProvider",
    );
  }
  return ctx;
}
