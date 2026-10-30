import { create } from "zustand";
import type { HtmlNode } from "@/types/HtmlNode";
import { deleteNodeFromArray, findNodeByKey, isDescendant } from "@/lib/htmlTree";
import { saveHtmlJson, deleteHtmlJson } from "@/lib/htmlStorage";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import {
  findNodeInTree,
  collectAllDescendantKeys,
  moveNodesGroup,
  duplicateNodesGroup,
  normalizeSelectedKeys,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";

export interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside";
}

export interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface PotentialDrag {
  key: string;
  startX: number;
  startY: number;
}

export interface CanvasState {
  // ── 1. Дерево и структура ──────────────────────────────────────────────────
  currentJson: HtmlNode[];
  collapsedKeys: Set<string>;

  // ── 2. Выбор и ховер ───────────────────────────────────────────────────────
  clickedKey: string | null;
  hoveredKey: string | null;

  // ── 3. Сплит-режим (Pane 1 / Pane 2) ───────────────────────────────────────
  isSplit: boolean;
  rightKeys: Set<string>;

  // ── 4. Рамочное выделение (Marquee) ────────────────────────────────────────
  selectionBox: SelectionBox | null;
  selectedKeys: Set<string>;

  // ── 5. Drag-and-Drop ───────────────────────────────────────────────────────
  potentialDrag: PotentialDrag | null;
  draggedKeys: string[];
  dropTarget: DropTarget | null;
  dragMousePos: { x: number; y: number } | null;

  // ── 6. История изменений ───────────────────────────────────────────────────
  historyStack: HtmlNode[][];
  futureStack: HtmlNode[][];
  canUndo: boolean;
  canRedo: boolean;

  // ── Actions: Модификация дерева и БД ───────────────────────────────────────
  setCurrentJson: (nodes: HtmlNode[]) => void;
  persist: (next: HtmlNode[], recordHistory?: boolean) => Promise<void>;
  deleteNode: (key: string) => Promise<void>;
  recordSnapshot: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // ── Actions: Сворачивание и выбор ─────────────────────────────────────────
  setClickedKey: (key: string | null) => void;
  setHoveredKey: (key: string | null) => void;
  toggleCollapseKey: (key: string) => void;
  setCollapsedKeys: (keys: Set<string>) => void;
  collapseAll: (keys: string[]) => void;

  // ── Actions: Сплит-режим ───────────────────────────────────────────────────
  toggleSplitMode: () => void;
  setRightKeys: (keys: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  moveKeysToRightPane: (keys: string[]) => void;
  moveKeysToLeftPane: (keys: string[]) => void;

  // ── Actions: Рамка выделения ───────────────────────────────────────────────
  setSelectionBox: (box: SelectionBox | null) => void;
  setSelectedKeys: (keys: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  clearSelection: () => void;

  // ── Actions: Drag-and-Drop ─────────────────────────────────────────────────
  startDragNode: (key: string, clientX: number, clientY: number) => void;
  setPotentialDrag: (drag: PotentialDrag | null) => void;
  setDraggedKeys: (keys: string[]) => void;
  setDropTarget: (target: DropTarget | null) => void;
  setDragMousePos: (pos: { x: number; y: number } | null) => void;
  commitDrop: () => Promise<void>;
  cancelDrag: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // ── Исходное состояние ─────────────────────────────────────────────────────
  currentJson: [],
  collapsedKeys: new Set<string>(),

  clickedKey: null,
  hoveredKey: null,

  isSplit: false,
  rightKeys: new Set<string>(),

  selectionBox: null,
  selectedKeys: new Set<string>(),

  potentialDrag: null,
  draggedKeys: [],
  dropTarget: null,
  dragMousePos: null,

  historyStack: [],
  futureStack: [],
  canUndo: false,
  canRedo: false,

  // ── Actions: Дерево и сохранение ───────────────────────────────────────────
  setCurrentJson: (nodes) => set({ currentJson: nodes }),

  recordSnapshot: () => {
    const current = get().currentJson;
    const snapshot = JSON.parse(JSON.stringify(current));
    set((state) => ({
      historyStack: [...state.historyStack.slice(-49), snapshot],
      futureStack: [],
      canUndo: true,
      canRedo: false,
    }));
  },

  persist: async (next, recordHistory = true) => {
    if (recordHistory) {
      get().recordSnapshot();
    }

    set({ currentJson: next });

    try {
      if (next.length > 0) {
        await saveHtmlJson(DB_KEY, next);
      } else {
        await deleteHtmlJson(DB_KEY);
      }
      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", {
          detail: { nodes: next, source: "canvas-area" },
        }),
      );
    } catch (e) {
      console.error("[useCanvasStore] Persist error:", e);
    }
  },

  deleteNode: async (key: string) => {
    const current = get().currentJson;
    const next = deleteNodeFromArray(current, key);
    if (get().clickedKey === key) {
      set({ clickedKey: null });
    }
    set({ hoveredKey: null });
    await get().persist(next);
  },

  undo: async () => {
    const { historyStack, futureStack, currentJson } = get();
    if (historyStack.length === 0) return;

    const previousState = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, -1);
    const newFuture = [JSON.parse(JSON.stringify(currentJson)), ...futureStack];

    set({
      currentJson: previousState,
      historyStack: newHistory,
      futureStack: newFuture,
      canUndo: newHistory.length > 0,
      canRedo: true,
    });

    await saveHtmlJson(DB_KEY, previousState);
    window.dispatchEvent(
      new CustomEvent("plaza-tree-updated", {
        detail: { nodes: previousState, source: "canvas-area" },
      }),
    );
  },

  redo: async () => {
    const { historyStack, futureStack, currentJson } = get();
    if (futureStack.length === 0) return;

    const nextState = futureStack[0];
    const newFuture = futureStack.slice(1);
    const newHistory = [...historyStack, JSON.parse(JSON.stringify(currentJson))];

    set({
      currentJson: nextState,
      historyStack: newHistory,
      futureStack: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });

    await saveHtmlJson(DB_KEY, nextState);
    window.dispatchEvent(
      new CustomEvent("plaza-tree-updated", {
        detail: { nodes: nextState, source: "canvas-area" },
      }),
    );
  },

  // ── Actions: Выбор и сворачивание ──────────────────────────────────────────
  setClickedKey: (key) => set({ clickedKey: key }),
  setHoveredKey: (key) => set({ hoveredKey: key }),

  toggleCollapseKey: (key) =>
    set((state) => {
      const next = new Set(state.collapsedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { collapsedKeys: next };
    }),

  setCollapsedKeys: (keys) => set({ collapsedKeys: keys }),

  collapseAll: (keys) => set({ collapsedKeys: new Set(keys) }),

  // ── Actions: Сплит-режим ───────────────────────────────────────────────────
  toggleSplitMode: () =>
    set((state) => ({
      isSplit: !state.isSplit,
      rightKeys: !state.isSplit ? state.rightKeys : new Set(),
    })),

  setRightKeys: (keys) =>
    set((state) => ({
      rightKeys: typeof keys === "function" ? keys(state.rightKeys) : keys,
    })),

  moveKeysToRightPane: (keys) => {
    const { currentJson } = get();
    const allSubtreeKeys: string[] = [];
    for (const k of keys) {
      const subtree = findNodeInTree(currentJson, k);
      if (subtree) {
        allSubtreeKeys.push(...collectAllDescendantKeys(subtree));
      } else {
        allSubtreeKeys.push(k);
      }
    }
    set((state) => {
      const next = new Set(state.rightKeys);
      for (const k of allSubtreeKeys) next.add(k);
      return { rightKeys: next };
    });
  },

  moveKeysToLeftPane: (keys) => {
    const { currentJson } = get();
    const allSubtreeKeys: string[] = [];
    for (const k of keys) {
      const subtree = findNodeInTree(currentJson, k);
      if (subtree) {
        allSubtreeKeys.push(...collectAllDescendantKeys(subtree));
      } else {
        allSubtreeKeys.push(k);
      }
    }
    set((state) => {
      const next = new Set(state.rightKeys);
      for (const k of allSubtreeKeys) next.delete(k);
      return { rightKeys: next };
    });
  },

  // ── Actions: Рамка выделения ───────────────────────────────────────────────
  setSelectionBox: (box) => set({ selectionBox: box }),

  setSelectedKeys: (keys) =>
    set((state) => ({
      selectedKeys: typeof keys === "function" ? keys(state.selectedKeys) : keys,
    })),

  clearSelection: () => set({ selectedKeys: new Set() }),

  // ── Actions: Drag-and-Drop ─────────────────────────────────────────────────
  startDragNode: (key, clientX, clientY) => {
    set({
      potentialDrag: { key, startX: clientX, startY: clientY },
    });
  },

  setPotentialDrag: (drag) => set({ potentialDrag: drag }),
  setDraggedKeys: (keys) => set({ draggedKeys: keys }),
  setDropTarget: (target) => set({ dropTarget: target }),
  setDragMousePos: (pos) => set({ dragMousePos: pos }),

  commitDrop: async () => {
    const { currentJson, draggedKeys, dropTarget } = get();
    if (draggedKeys.length > 0 && dropTarget && dropTarget.key) {
      if (dropTarget.position === "self") {
        const updated = duplicateNodesGroup(currentJson, draggedKeys);
        await get().persist(updated);
      } else {
        const updated = moveNodesGroup(
          currentJson,
          draggedKeys,
          dropTarget.key,
          dropTarget.position,
        );
        await get().persist(updated);
      }
    }

    set({
      potentialDrag: null,
      draggedKeys: [],
      dropTarget: null,
      dragMousePos: null,
    });
  },

  cancelDrag: () => {
    set({
      potentialDrag: null,
      draggedKeys: [],
      dropTarget: null,
      dragMousePos: null,
    });
  },
}));
