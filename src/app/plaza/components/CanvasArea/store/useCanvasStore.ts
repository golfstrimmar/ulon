import { create } from "zustand";
import type { HtmlNode } from "@/types/HtmlNode";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import type { BreakpointId } from "@/app/plaza/components/PreviewArea/types/breakpoints";
import { deleteNodeFromArray, isDescendant } from "@/lib/htmlTree";
import {
  saveHtmlJson,
  deleteHtmlJson,
  getGlobalScss,
  saveGlobalScss,
  getGlobalJs,
  saveGlobalJs,
} from "@/lib/htmlStorage";

import {
  findNodeInTree,
  collectAllDescendantKeys,
  collectAllTreeKeys,
  normalizeSelectedKeys,
  moveNodesGroup,
  duplicateNodesGroup,
  mergeDonorIntoTarget,
  applyBemClassesToSection,
  fillTemplateWithDonors,
  fillSingleSlotInPlace,
  fillMultipleSlotsInPlace,
  applyDonorToSlot,
  mutateNodeInTree,
  removeNodesByKeys,
  computeToggledCollapsedKeys,
  prepareAppendedNodes,
  mergeScssWithoutDuplicates,
  mergeScriptsWithoutDuplicates,
  findMarkerKeyInTree,
  createMarkerNode,
  insertNodesAdjacent,
  splitWorkspaceNodes,
  ensureUniqueKeys,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { blendPresetStyleAction } from "@/actions/blendPresetStyleAction";

export interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside" | "donor";
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
  currentJson: HtmlNode[];
  collapsedKeys: Set<string>;

  clickedKey: string | null;
  hoveredKey: string | null;

  isSplit: boolean;
  rightKeys: Set<string>;
  isDonorMode: boolean;

  // ── Template Mode ────────────────────────────────────────────────────────
  isTemplateMode: boolean;
  templateSlotKeys: string[];
  hudMessage: { text: string; type: "info" | "warning" | "success" } | null;

  // ── AI Style Transplant Mode ─────────────────────────────────────────────
  isStyleTransplantMode: boolean;
  isBlendingStyles: boolean;
  toggleStyleTransplantMode: () => void;
  blendStylesFromPanes: () => Promise<boolean>;

  // ── Insertion Marker ─────────────────────────────────────────────────────
  isArmingMarker: boolean;
  toggleArmingMarker: () => void;
  setArmingMarker: (val: boolean) => void;
  placeMarkerAtNode: (targetKey: string) => Promise<void>;
  keepMarkerAfterInsert: boolean;
  toggleKeepMarkerAfterInsert: () => void;
  insertMarkerNode: () => Promise<void>;
  removeMarkerNode: () => Promise<void>;

  // ── Breakpoints State (Zustand only) ─────────────────────────────────────
  activeBreakpointId: BreakpointId;
  customBreakpointWidth: number | null;
  isBreakpointRotated: boolean;

  selectionBox: SelectionBox | null;
  selectedKeys: Set<string>;

  potentialDrag: PotentialDrag | null;
  draggedKeys: string[];
  dropTarget: DropTarget | null;
  dragMousePos: { x: number; y: number } | null;

  historyStack: HtmlNode[][];
  futureStack: HtmlNode[][];
  canUndo: boolean;
  canRedo: boolean;

  setCurrentJson: (nodes: HtmlNode[]) => void;
  persist: (next: HtmlNode[], recordHistory?: boolean) => Promise<void>;
  applyBemClasses: () => Promise<void>;
  deleteNode: (key: string) => Promise<void>;
  deleteSelectedNodes: () => Promise<void>;
  recordSnapshot: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  setClickedKey: (key: string | null) => void;
  setHoveredKey: (key: string | null) => void;
  toggleCollapseKey: (key: string) => void;
  setCollapsedKeys: (keys: Set<string>) => void;
  collapseAll: (keys: string[]) => void;

  toggleSplitMode: () => void;
  toggleDonorMode: () => void;
  setDonorMode: (val: boolean) => void;
  setRightKeys: (
    keys: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void;
  moveKeysToRightPane: (keys: string[]) => void;
  moveKeysToLeftPane: (keys: string[]) => void;

  // ── Template Mode Actions ─────────────────────────────────────────────────
  toggleTemplateMode: () => void;
  toggleTemplateSlot: (key: string) => void;
  clearTemplateSlots: () => void;
  showHud: (text: string, type?: "info" | "warning" | "success") => void;
  fillTemplateFromDonors: (donorKeys: string[]) => Promise<boolean>;
  fillNextTemplateSlot: (donorKey: string) => Promise<boolean>;
  fillTemplateSlotsBatch: (donorKeys: string[]) => Promise<boolean>;

  // ── Armed Donor (Preview & Tracing) ──────────────────────────────────────
  armedDonorKey: string | null;
  setArmedDonorKey: (key: string | null) => void;
  applyArmedDonorToTarget: (targetKey: string) => Promise<boolean>;

  // ──
  toggleCollapseAll: () => void;
  clearCanvasTree: () => Promise<void>;
  appendNodesFromPath: (path: string) => Promise<boolean>;
  appendRawNodes: (raw: HtmlNode | HtmlNode[]) => Promise<boolean>;

  // ── Breakpoints Actions ───────────────────────────────────────────────────
  selectBreakpoint: (id: BreakpointId) => void;
  setCustomBreakpointWidth: (width: number) => void;
  toggleBreakpointRotate: () => void;

  setSelectionBox: (box: SelectionBox | null) => void;
  setSelectedKeys: (
    keys: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void;
  clearSelection: () => void;

  isAsideFloating: boolean;
  isCanvasFloating: boolean;
  toggleCanvasFloating: () => void;
  setCanvasFloating: (val: boolean) => void;
  toggleAsideFloating: () => void;
  setAsideFloating: (val: boolean) => void;

  startDragNode: (key: string, clientX: number, clientY: number) => void;
  setPotentialDrag: (drag: PotentialDrag | null) => void;
  setDraggedKeys: (keys: string[]) => void;
  setDropTarget: (target: DropTarget | null) => void;
  setDragMousePos: (pos: { x: number; y: number } | null) => void;
  commitDrop: () => Promise<void>;
  cancelDrag: () => void;
}

let hudTimeout: ReturnType<typeof setTimeout> | null = null;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  currentJson: [],
  collapsedKeys: new Set<string>(),
  isCanvasFloating: false,
  clickedKey: null,
  hoveredKey: null,

  isSplit: false,
  rightKeys: new Set<string>(),
  isDonorMode: false,

  isTemplateMode: false,
  templateSlotKeys: [],
  hudMessage: null,

  isStyleTransplantMode: false,
  isBlendingStyles: false,

  isArmingMarker: false,
  keepMarkerAfterInsert: false,

  armedDonorKey: null,

  activeBreakpointId: "full",
  customBreakpointWidth: null,
  isBreakpointRotated: false,

  selectionBox: null,
  selectedKeys: new Set<string>(),

  isAsideFloating: false,

  potentialDrag: null,
  draggedKeys: [],
  dropTarget: null,
  dragMousePos: null,

  historyStack: [],
  futureStack: [],
  canUndo: false,
  canRedo: false,

  toggleCanvasFloating: () =>
    set((state) => ({ isCanvasFloating: !state.isCanvasFloating })),

  setCanvasFloating: (val) => set({ isCanvasFloating: val }),
  setCurrentJson: (nodes) => set({ currentJson: nodes }),

  toggleKeepMarkerAfterInsert: () =>
    set((state) => ({ keepMarkerAfterInsert: !state.keepMarkerAfterInsert })),

  setArmingMarker: (val) =>
    set({
      isArmingMarker: val,
      clickedKey: val ? null : get().clickedKey,
    }),

  toggleArmingMarker: () => {
    const { currentJson, isArmingMarker } = get();
    if (!currentJson || currentJson.length === 0) {
      void get().insertMarkerNode();
      return;
    }
    const next = !isArmingMarker;
    set({
      isArmingMarker: next,
      clickedKey: next ? null : get().clickedKey,
    });
    if (next) {
      get().showHud("📍 Кликните по ноде, чтобы поставить маркер", "info");
    }
  },

  placeMarkerAtNode: async (targetKey: string) => {
    const { currentJson, isSplit, rightKeys } = get();
    let tree = currentJson;
    const existingMarkerKey = findMarkerKeyInTree(tree);
    if (existingMarkerKey) {
      tree = deleteNodeFromArray(tree, existingMarkerKey);
    }

    const marker = createMarkerNode();
    const markerKey = marker._key!;
    let nextTree: HtmlNode[];
    let putInRight = false;

    if (targetKey && findNodeInTree(tree, targetKey)) {
      nextTree = insertNodesAdjacent(
        tree,
        targetKey,
        [marker],
        "after",
      );
      putInRight = isSplit && rightKeys.has(targetKey);
    } else {
      nextTree = [...tree, marker];
      putInRight = false;
    }

    set((state) => {
      const nextRight = new Set(state.rightKeys);
      if (existingMarkerKey) {
        nextRight.delete(existingMarkerKey);
      }
      if (putInRight) {
        nextRight.add(markerKey);
      }
      return {
        rightKeys: nextRight,
        isArmingMarker: false,
        clickedKey: null,
      };
    });

    get().showHud(
      "Маркер установлен — жмите кнопку в Aside для вставки",
      "success",
    );
    await get().persist(nextTree);
  },

  insertMarkerNode: async () => {
    const { currentJson, clickedKey, isSplit, rightKeys } = get();
    const existingMarkerKey = findMarkerKeyInTree(currentJson);

    if (existingMarkerKey) {
      set({ clickedKey: existingMarkerKey });
      get().showHud(
        "Маркер уже на канвасе — перетащи его в нужное место",
        "info",
      );
      return;
    }

    const marker = createMarkerNode();
    const markerKey = marker._key!;
    let nextTree: HtmlNode[];
    let putInRight = false;

    if (clickedKey && findNodeInTree(currentJson, clickedKey)) {
      nextTree = insertNodesAdjacent(
        currentJson,
        clickedKey,
        [marker],
        "after",
      );
      putInRight = isSplit && rightKeys.has(clickedKey);
    } else {
      nextTree = [...currentJson, marker];
      putInRight = false;
    }

    if (putInRight) {
      set((state) => {
        const next = new Set(state.rightKeys);
        next.add(markerKey);
        return { rightKeys: next };
      });
    }

    get().showHud(
      "Маркер добавлен — перетащи куда нужно и жми кнопку в Aside",
      "success",
    );
    await get().persist(nextTree);
  },

  removeMarkerNode: async () => {
    const { currentJson } = get();
    const markerKey = findMarkerKeyInTree(currentJson);
    if (!markerKey) return;
    await get().deleteNode(markerKey);
  },

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
    const targetNode = findNodeInTree(current, key);
    const removedSet = new Set(
      targetNode ? collectAllDescendantKeys(targetNode) : [key],
    );

    const next = deleteNodeFromArray(current, key);

    set((state) => {
      const nextSelected = new Set(state.selectedKeys);
      const nextRight = new Set(state.rightKeys);
      const nextCollapsed = new Set(state.collapsedKeys);
      removedSet.forEach((k) => {
        nextSelected.delete(k);
        nextRight.delete(k);
        nextCollapsed.delete(k);
      });

      return {
        selectedKeys: nextSelected,
        rightKeys: nextRight,
        collapsedKeys: nextCollapsed,
        templateSlotKeys: state.templateSlotKeys.filter(
          (k) => !removedSet.has(k),
        ),
        clickedKey: removedSet.has(state.clickedKey || "")
          ? null
          : state.clickedKey,
        hoveredKey: removedSet.has(state.hoveredKey || "")
          ? null
          : state.hoveredKey,
        armedDonorKey: removedSet.has(state.armedDonorKey || "")
          ? null
          : state.armedDonorKey,
      };
    });

    await get().persist(next);
  },

  deleteSelectedNodes: async () => {
    const { currentJson, selectedKeys } = get();
    if (selectedKeys.size === 0) return;

    const orderedKeys = normalizeSelectedKeys(currentJson, selectedKeys);
    if (orderedKeys.length === 0) return;

    const removedAllKeys = new Set<string>();
    for (const k of orderedKeys) {
      const node = findNodeInTree(currentJson, k);
      if (node) {
        collectAllDescendantKeys(node).forEach((id) => removedAllKeys.add(id));
      } else {
        removedAllKeys.add(k);
      }
    }

    const next = removeNodesByKeys(currentJson, new Set(orderedKeys));

    set((state) => {
      const nextRight = new Set(state.rightKeys);
      const nextCollapsed = new Set(state.collapsedKeys);
      removedAllKeys.forEach((k) => {
        nextRight.delete(k);
        nextCollapsed.delete(k);
      });

      return {
        selectedKeys: new Set(),
        rightKeys: nextRight,
        collapsedKeys: nextCollapsed,
        templateSlotKeys: state.templateSlotKeys.filter(
          (k) => !removedAllKeys.has(k),
        ),
        clickedKey: removedAllKeys.has(state.clickedKey || "")
          ? null
          : state.clickedKey,
        hoveredKey: removedAllKeys.has(state.hoveredKey || "")
          ? null
          : state.hoveredKey,
        armedDonorKey: removedAllKeys.has(state.armedDonorKey || "")
          ? null
          : state.armedDonorKey,
      };
    });

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
    const newHistory = [
      ...historyStack,
      JSON.parse(JSON.stringify(currentJson)),
    ];

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

  applyBemClasses: async () => {
    const { currentJson, clickedKey, selectedKeys } = get();
    const targetKeys =
      selectedKeys.size > 0
        ? Array.from(selectedKeys)
        : clickedKey
          ? [clickedKey]
          : [null];

    let updated = currentJson;
    for (const key of targetKeys) {
      updated = applyBemClassesToSection(updated, key);
    }
    await get().persist(updated);
  },

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

  toggleSplitMode: () =>
    set((state) => ({
      isSplit: !state.isSplit,
      rightKeys: !state.isSplit ? state.rightKeys : new Set(),
      isTemplateMode: !state.isSplit ? state.isTemplateMode : false,
      templateSlotKeys: !state.isSplit ? state.templateSlotKeys : [],
      isStyleTransplantMode: !state.isSplit ? state.isStyleTransplantMode : false,
    })),

  toggleStyleTransplantMode: () => {
    const nextMode = !get().isStyleTransplantMode;
    set((state) => ({
      isStyleTransplantMode: nextMode,
      isSplit: nextMode ? true : state.isSplit,
    }));
    if (nextMode) {
      get().showHud(
        "AI Styler: Слева — донор Figma, Справа — пресет. Нажмите 'Перенести стили'.",
        "info",
      );
    } else {
      get().showHud("AI Styler: выключен", "info");
    }
  },

  blendStylesFromPanes: async () => {
    const { currentJson, rightKeys, isSplit, isBlendingStyles } = get();
    if (isBlendingStyles) return false;

    const { leftNodes, rightNodes } = splitWorkspaceNodes(
      currentJson,
      rightKeys,
      isSplit,
    );

    if (leftNodes.length === 0) {
      get().showHud("В левой панели (донор) нет элементов!", "warning");
      return false;
    }

    if (rightNodes.length === 0) {
      get().showHud("В правой панели (пресет) нет элементов!", "warning");
      return false;
    }

    set({ isBlendingStyles: true });
    get().showHud("AI переносит стили с донора на пресет...", "info");

    try {
      const res = await blendPresetStyleAction({
        donorNode: leftNodes,
        presetNode: rightNodes,
      });

      if (!res.success || !res.styledPreset || res.styledPreset.length === 0) {
        set({ isBlendingStyles: false });
        get().showHud(res.error || "Ошибка переноса стилей", "warning");
        return false;
      }

      const newRightNodes = ensureUniqueKeys(res.styledPreset);
      const newRightKeys = collectAllTreeKeys(newRightNodes);

      const nextTree = [...leftNodes, ...newRightNodes];

      set({
        rightKeys: newRightKeys,
        isBlendingStyles: false,
      });

      await get().persist(nextTree, true);
      get().showHud("Стили успешно перенесены в пресет!", "success");
      return true;
    } catch (err: any) {
      console.error("[useCanvasStore] blendStylesFromPanes error:", err);
      set({ isBlendingStyles: false });
      get().showHud(
        err?.message || "Ошибка при выполнении стилизации",
        "warning",
      );
      return false;
    }
  },

  toggleDonorMode: () =>
    set((state) => ({
      isDonorMode: !state.isDonorMode,
    })),

  setDonorMode: (val) => set({ isDonorMode: val }),

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

  setArmedDonorKey: (key) => set({ armedDonorKey: key }),

  applyArmedDonorToTarget: async (targetKey: string) => {
    const { currentJson, armedDonorKey, rightKeys } = get();
    if (!armedDonorKey || !targetKey || armedDonorKey === targetKey) {
      return false;
    }

    const donorNode = findNodeInTree(currentJson, armedDonorKey);
    const targetNode = findNodeInTree(currentJson, targetKey);
    if (!donorNode || !targetNode) {
      set({ armedDonorKey: null });
      return false;
    }

    if (
      isDescendant(donorNode, targetKey) ||
      isDescendant(targetNode, armedDonorKey)
    ) {
      get().showHud("Cannot merge parent with its own descendant", "warning");
      return false;
    }

    const nextTargetNode = applyDonorToSlot(targetNode, donorNode);

    const addedRightKeys: string[] = [];
    if (
      rightKeys.has(targetKey) &&
      (!targetNode.children || targetNode.children.length === 0) &&
      Array.isArray(nextTargetNode.children) &&
      nextTargetNode.children.length > 0
    ) {
      for (const child of nextTargetNode.children) {
        addedRightKeys.push(...collectAllDescendantKeys(child));
      }
    }

    const updatedTree = mutateNodeInTree(
      currentJson,
      targetKey,
      () => nextTargetNode,
    );
    const nextTree = removeNodesByKeys(updatedTree, new Set([armedDonorKey]));

    set((state) => {
      const nextRight = new Set(state.rightKeys);
      nextRight.delete(armedDonorKey);
      for (const k of addedRightKeys) {
        nextRight.add(k);
      }
      return {
        rightKeys: nextRight,
        armedDonorKey: null,
        templateSlotKeys: state.templateSlotKeys.filter(
          (k) => k !== armedDonorKey,
        ),
        clickedKey:
          state.clickedKey === armedDonorKey ? null : state.clickedKey,
        hoveredKey:
          state.hoveredKey === armedDonorKey ? null : state.hoveredKey,
      };
    });

    get().showHud("Donor applied!", "success");
    await get().persist(nextTree);
    return true;
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
      return {
        rightKeys: next,
        templateSlotKeys: state.templateSlotKeys.filter(
          (slotKey) => !allSubtreeKeys.includes(slotKey),
        ),
      };
    });
  },

  toggleTemplateMode: () => {
    const nextMode = !get().isTemplateMode;
    set((state) => ({
      isTemplateMode: nextMode,
      isSplit: nextMode ? true : state.isSplit,
      templateSlotKeys: nextMode ? state.templateSlotKeys : [],
    }));
    if (nextMode) {
      get().showHud(
        "Template mode: ON. Click nodes in Right Pane to assign slots [1], [2]...",
        "info",
      );
    } else {
      get().showHud("Template mode: OFF", "info");
    }
  },

  toggleTemplateSlot: (key: string) => {
    if (!key) return;
    set((state) => {
      const existingIdx = state.templateSlotKeys.indexOf(key);
      const updated =
        existingIdx !== -1
          ? state.templateSlotKeys.filter((k) => k !== key)
          : [...state.templateSlotKeys, key];

      return { templateSlotKeys: updated };
    });
  },

  clearTemplateSlots: () => set({ templateSlotKeys: [] }),

  showHud: (text: string, type: "info" | "warning" | "success" = "info") => {
    if (hudTimeout) clearTimeout(hudTimeout);
    set({ hudMessage: { text, type } });
    hudTimeout = setTimeout(() => {
      set({ hudMessage: null });
      hudTimeout = null;
    }, 3200);
  },

  fillTemplateFromDonors: async (donorKeys: string[]) => {
    const { currentJson, rightKeys, templateSlotKeys } = get();

    if (templateSlotKeys.length === 0) {
      get().showHud(
        "No slots assigned in template! Click nodes in Right Pane first.",
        "warning",
      );
      return false;
    }

    if (rightKeys.size === 0) {
      get().showHud("Right pane template is empty!", "warning");
      return false;
    }

    const result = fillTemplateWithDonors(
      currentJson,
      rightKeys,
      templateSlotKeys,
      donorKeys,
    );

    if (!result) return false;

    if (result.warning) {
      get().showHud(result.warning, "warning");
    } else {
      get().showHud(
        `Template populated successfully (${result.usedCount} slots)!`,
        "success",
      );
    }

    await get().persist(result.nextTree);
    return true;
  },

  fillNextTemplateSlot: async (donorKey: string) => {
    const { currentJson, rightKeys, templateSlotKeys } = get();

    if (templateSlotKeys.length === 0) {
      get().showHud(
        "No slots assigned! Click nodes in Right Pane first.",
        "warning",
      );
      return false;
    }

    const targetSlotKey = templateSlotKeys[0];
    const result = fillSingleSlotInPlace(
      currentJson,
      rightKeys,
      targetSlotKey,
      donorKey,
    );

    if (!result) return false;

    const remainingSlots = templateSlotKeys.slice(1);

    set((state) => {
      const nextRight = new Set(state.rightKeys);
      for (const k of result.addedRightKeys) {
        nextRight.add(k);
      }
      return {
        rightKeys: nextRight,
        templateSlotKeys: remainingSlots,
        clickedKey: state.clickedKey === donorKey ? null : state.clickedKey,
        hoveredKey: state.hoveredKey === donorKey ? null : state.hoveredKey,
      };
    });

    if (remainingSlots.length === 0) {
      get().showHud("All template slots filled!", "success");
    } else {
      get().showHud(
        `Filled slot! ${remainingSlots.length} slot(s) remaining`,
        "info",
      );
    }

    await get().persist(result.nextTree);
    return true;
  },

  fillTemplateSlotsBatch: async (donorKeys: string[]) => {
    const { currentJson, rightKeys, templateSlotKeys } = get();

    if (templateSlotKeys.length === 0 || donorKeys.length === 0) {
      return false;
    }

    const result = fillMultipleSlotsInPlace(
      currentJson,
      rightKeys,
      templateSlotKeys,
      donorKeys,
    );

    if (!result) return false;

    const usedSet = new Set(result.usedDonorKeys);

    set((state) => {
      const nextRight = new Set(state.rightKeys);
      for (const k of result.addedRightKeys) {
        nextRight.add(k);
      }
      return {
        rightKeys: nextRight,
        templateSlotKeys: result.remainingSlotKeys,
        clickedKey:
          state.clickedKey && usedSet.has(state.clickedKey)
            ? null
            : state.clickedKey,
        hoveredKey:
          state.hoveredKey && usedSet.has(state.hoveredKey)
            ? null
            : state.hoveredKey,
      };
    });

    if (result.excessCount > 0) {
      get().showHud(
        `Filled ${result.filledCount} slot(s). ${result.excessCount} excess donor(s) skipped.`,
        "warning",
      );
    } else if (result.remainingSlotKeys.length === 0) {
      get().showHud(
        `Filled ${result.filledCount} slot(s). All template slots filled!`,
        "success",
      );
    } else {
      get().showHud(
        `Filled ${result.filledCount} slot(s)! ${result.remainingSlotKeys.length} remaining`,
        "info",
      );
    }

    await get().persist(result.nextTree);
    return true;
  },

  toggleCollapseAll: () => {
    const { currentJson, collapsedKeys } = get();
    set({
      collapsedKeys: computeToggledCollapsedKeys(currentJson, collapsedKeys),
    });
  },

  clearCanvasTree: async () => {
    await deleteHtmlJson(DB_KEY);
    set({
      currentJson: [],
      rightKeys: new Set(),
      templateSlotKeys: [],
      clickedKey: null,
      hoveredKey: null,
      armedDonorKey: null,
      selectedKeys: new Set(),
      collapsedKeys: new Set(),
    });
    window.dispatchEvent(
      new CustomEvent("plaza-tree-updated", {
        detail: { nodes: [], source: "aside-canvas" },
      }),
    );
  },

  appendRawNodes: async (raw: HtmlNode | HtmlNode[]) => {
    try {
      const { currentJson, isSplit, rightKeys, keepMarkerAfterInsert } = get();
      const markerKey = findMarkerKeyInTree(currentJson);
      const markerInRightPane = Boolean(markerKey && rightKeys.has(markerKey));

      const {
        nextTree,
        extractedScss,
        extractedScripts,
        addedRightKeys,
        replacedMarkerKey,
      } = prepareAppendedNodes(currentJson, raw, isSplit, {
        markerKey,
        keepMarker: keepMarkerAfterInsert,
        markerInRightPane,
      });

      if (extractedScss) {
        const currentScss = (await getGlobalScss().catch(() => "")) || "";
        const nextScss = mergeScssWithoutDuplicates(currentScss, extractedScss);
        if (nextScss !== currentScss) {
          await saveGlobalScss(nextScss);
          window.dispatchEvent(
            new CustomEvent("plaza-styles-updated", { detail: nextScss }),
          );
        }
      }

      if (extractedScripts.length > 0) {
        const currentJs = (await getGlobalJs().catch(() => "")) || "";
        const nextBundle = mergeScriptsWithoutDuplicates(
          currentJs,
          extractedScripts,
        );
        if (nextBundle !== currentJs) {
          await saveGlobalJs(nextBundle);
          window.dispatchEvent(
            new CustomEvent("plaza-scripts-updated", { detail: nextBundle }),
          );
        }
      }

      if (
        addedRightKeys.length > 0 ||
        (replacedMarkerKey && !keepMarkerAfterInsert)
      ) {
        set((state) => {
          const next = new Set(state.rightKeys);
          if (replacedMarkerKey && !keepMarkerAfterInsert) {
            next.delete(replacedMarkerKey);
          }
          addedRightKeys.forEach((k) => next.add(k));
          return {
            rightKeys: next,
            clickedKey:
              replacedMarkerKey &&
              !keepMarkerAfterInsert &&
              state.clickedKey === replacedMarkerKey
                ? null
                : state.clickedKey,
          };
        });
      }

      if (replacedMarkerKey) {
        get().showHud(
          keepMarkerAfterInsert
            ? "Вставлено перед маркером!"
            : "Маркер заменён новой нодой!",
          "success",
        );
      }

      await get().persist(nextTree);
      return true;
    } catch (e) {
      console.error("[useCanvasStore] appendRawNodes error:", e);
      return false;
    }
  },

  appendNodesFromPath: async (path: string) => {
    try {
      const res = await fetch(path);
      if (!res.ok) return false;
      const raw = await res.json();
      return await get().appendRawNodes(raw);
    } catch (e) {
      console.error(`Error adding from ${path}:`, e);
      return false;
    }
  },

  selectBreakpoint: (id: BreakpointId) => {
    set((state) => ({
      activeBreakpointId: id,
      customBreakpointWidth:
        id === "custom" ? state.customBreakpointWidth || 800 : null,
      isBreakpointRotated: false,
    }));
  },

  setCustomBreakpointWidth: (width: number) => {
    const clamped = Math.max(280, Math.min(3840, Math.round(width)));
    set({
      activeBreakpointId: "custom",
      customBreakpointWidth: clamped,
      isBreakpointRotated: false,
    });
  },

  toggleBreakpointRotate: () => {
    set((state) => ({
      isBreakpointRotated: !state.isBreakpointRotated,
    }));
  },

  setSelectionBox: (box) => set({ selectionBox: box }),

  setSelectedKeys: (keys) =>
    set((state) => ({
      selectedKeys:
        typeof keys === "function" ? keys(state.selectedKeys) : keys,
    })),

  clearSelection: () => set({ selectedKeys: new Set() }),

  toggleAsideFloating: () =>
    set((state) => ({ isAsideFloating: !state.isAsideFloating })),

  setAsideFloating: (val) => set({ isAsideFloating: val }),

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
    const { currentJson, draggedKeys, dropTarget, isSplit, rightKeys } = get();
    if (draggedKeys.length > 0 && dropTarget && dropTarget.key) {
      if (dropTarget.position === "donor") {
        const updated = mergeDonorIntoTarget(
          currentJson,
          draggedKeys,
          dropTarget.key,
        );
        set((state) => {
          const nextRight = new Set(state.rightKeys);
          for (const k of draggedKeys) nextRight.delete(k);
          return { rightKeys: nextRight };
        });
        await get().persist(updated);
      } else if (dropTarget.position === "self") {
        const existingKeys = collectAllTreeKeys(currentJson);
        const updated = duplicateNodesGroup(currentJson, draggedKeys);

        const clonedAllKeys: string[] = [];
        const collectNewNodes = (nodes: HtmlNode[]) => {
          for (const n of nodes) {
            const k = n._key || "";
            if (k && !existingKeys.has(k)) {
              clonedAllKeys.push(...collectAllDescendantKeys(n));
              continue;
            }
            if (Array.isArray(n.children)) collectNewNodes(n.children);
          }
        };
        collectNewNodes(updated);

        const shouldPutClonesInRight =
          isSplit && draggedKeys.every((k) => rightKeys.has(k));

        set((state) => {
          const nextCollapsed = new Set(state.collapsedKeys);
          for (const k of clonedAllKeys) {
            nextCollapsed.delete(k);
          }

          const nextRight = new Set(state.rightKeys);
          if (shouldPutClonesInRight) {
            for (const k of clonedAllKeys) {
              nextRight.add(k);
            }
          }

          return {
            collapsedKeys: nextCollapsed,
            rightKeys: nextRight,
          };
        });

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
