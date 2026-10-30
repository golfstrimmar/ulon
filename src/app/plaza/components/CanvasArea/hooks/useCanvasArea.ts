"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  getHtmlJson,
  saveHtmlJson,
  deleteHtmlJson,
  getGlobalScss,
  getGlobalJs,
  saveGlobalScss,
  saveGlobalJs,
} from "@/lib/htmlStorage";
import { findNodeByKey, deleteNodeFromArray } from "@/lib/htmlTree";
import {
  extractStylesAndScriptsFromNodes,
  mergeScssWithoutDuplicates,
  mergeScriptsWithoutDuplicates,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import { styleHistory } from "@/lib/styleHistory";
import { scriptsHistory } from "@/lib/scriptsHistory";

import { useCanvasHistory } from "./useCanvasHistory";
import { useCanvasDnD } from "./useCanvasDnD";

function ensureUniqueKeys(nodes: HtmlNode[]): HtmlNode[] {
  return nodes.map((node) => ({
    ...node,
    _key:
      node._key ||
      `${node.tag || "node"}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    children: Array.isArray(node.children)
      ? ensureUniqueKeys(node.children)
      : node.children,
  }));
}

export function useCanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const currentJsonRef = useRef<HtmlNode[]>([]);
  currentJsonRef.current = currentJson;

  // Выбор и ховер нод
  const [clickedKey, setClickedKey] = useState<string | null>(null);
  const clickedKeyRef = useRef<string | null>(null);
  clickedKeyRef.current = clickedKey;

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  // ─────🔹 История (Undo / Redo + хоткеи)
  const history = useCanvasHistory({
    currentJsonRef,
    setCurrentJson,
    saveToStorage: async (nodes) => {
      if (nodes.length > 0) await saveHtmlJson(DB_KEY, nodes);
      else await deleteHtmlJson(DB_KEY);
    },
  });

  // ─────🔹 Сохранение дерева
  const persist = useCallback(
    async (next: HtmlNode[], recordHistory = true) => {
      if (recordHistory) {
        history.recordSnapshot(currentJsonRef.current);
      }

      setCurrentJson(next);
      currentJsonRef.current = next;

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
        console.error("[useCanvasArea] Persist error:", e);
      }
    },
    [history],
  );

  // ─────🔹 Удаление узла
  const deleteNode = useCallback(
    async (key: string) => {
      const next = deleteNodeFromArray(currentJsonRef.current, key);
      if (clickedKeyRef.current === key) setClickedKey(null);
      setHoveredKey(null);
      await persist(next);
    },
    [persist],
  );

  // ─────🔹 Переключение сворачивания узла
  const toggleCollapseKey = useCallback((key: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ─────🔹 Drag and Drop
  const dnd = useCanvasDnD({
    currentJsonRef,
    persist,
  });

  // ─────🔹 Загрузка при монтировании
  const jsonDownload = async () => {
    try {
      const [dbScss, dbJs, data] = await Promise.all([
        getGlobalScss().catch(() => ""),
        getGlobalJs().catch(() => ""),
        getHtmlJson(DB_KEY).catch(() => null),
      ]);

      let currentScss = dbScss || "";
      let currentJs = dbJs || "";

      if (data) {
        const list = Array.isArray(data) ? data : [data];
        const { cleanNodes, extractedScss, extractedScripts } =
          extractStylesAndScriptsFromNodes(list);

        if (extractedScss) {
          currentScss = mergeScssWithoutDuplicates(currentScss, extractedScss);
        }
        if (extractedScripts.length > 0) {
          currentJs = mergeScriptsWithoutDuplicates(currentJs, extractedScripts);
        }

        const nodesWithKeys = ensureUniqueKeys(cleanNodes);
        setCurrentJson(nodesWithKeys);
        currentJsonRef.current = nodesWithKeys;

        styleHistory.init(currentScss);
        scriptsHistory.init(currentJs);

        await Promise.all([
          saveGlobalScss(currentScss),
          saveGlobalJs(currentJs),
          saveHtmlJson(DB_KEY, nodesWithKeys),
        ]);
      } else {
        setCurrentJson([]);
        currentJsonRef.current = [];
        styleHistory.init(currentScss);
        scriptsHistory.init(currentJs);

        await Promise.all([saveGlobalScss(currentScss), saveGlobalJs(currentJs)]);
      }
    } catch (err) {
      console.error("[useCanvasArea] Mount error:", err);
    }
  };

  useEffect(() => {
    jsonDownload();
  }, []);

  // ─────🔹 Слушаем клики из PreviewArea
  useEffect(() => {
    const handleSelectFromPreview = (e: any) => {
      if (e.detail?.source === "modal-properties") return;

      const { key, className, tag, text } = e.detail || {};
      if (key) {
        for (const root of currentJsonRef.current) {
          const found = findNodeByKey(root, key);
          if (found) {
            if (found._key !== clickedKeyRef.current) {
              setClickedKey(found._key ?? null);
            }
            return;
          }
        }
      }

      const findNodeFallback = (list: HtmlNode[]): HtmlNode | null => {
        for (const node of list) {
          if (className && node.class) {
            const classes = node.class.split(/\s+/).filter(Boolean);
            const targetClasses = className.trim().split(/\s+/).filter(Boolean);
            const specificClass = targetClasses[
              targetClasses.length - 1
            ]?.replace(/^\./, "");
            if (specificClass && classes.includes(specificClass)) {
              return node;
            }
          }
          if (
            text &&
            node.text?.trim() === text.trim() &&
            (!tag || node.tag === tag)
          ) {
            return node;
          }
          if (Array.isArray(node.children) && node.children.length > 0) {
            const found = findNodeFallback(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const targetNode = findNodeFallback(currentJsonRef.current);
      if (targetNode && targetNode._key !== clickedKeyRef.current) {
        setClickedKey(targetNode._key ?? null);
      }
    };

    window.addEventListener("plaza-node-selected", handleSelectFromPreview);
    return () =>
      window.removeEventListener("plaza-node-selected", handleSelectFromPreview);
  }, []);

  // ─────🔹 Сворачивание всех нод
  const getAllCollapsibleKeys = useCallback(
    (nodes: HtmlNode[] | null | undefined): string[] => {
      if (!nodes || !Array.isArray(nodes)) return [];
      const keys: string[] = [];
      function traverse(list: HtmlNode[]) {
        for (const node of list) {
          if (Array.isArray(node.children) && node.children.length > 0) {
            if (node._key) keys.push(node._key);
            traverse(node.children);
          }
        }
      }
      traverse(nodes);
      return keys;
    },
    [],
  );

  const collapsedAll = useCallback(() => {
    const allKeys = getAllCollapsibleKeys(currentJsonRef.current);
    setCollapsedKeys(new Set(allKeys));
  }, [getAllCollapsibleKeys]);

  useEffect(() => {
    const handleTreeUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.source === "canvas-area") return;

      const nodes = Array.isArray(customEvent.detail)
        ? customEvent.detail
        : customEvent.detail?.nodes;

      if (Array.isArray(nodes)) {
        const withKeys = ensureUniqueKeys(nodes);
        setCurrentJson(withKeys);
        currentJsonRef.current = withKeys;
      } else {
        jsonDownload();
      }
    };

    window.addEventListener("plaza-tree-updated", handleTreeUpdated);
    window.addEventListener("plaza-toggle-collapse-all", collapsedAll);

    return () => {
      window.removeEventListener("plaza-tree-updated", handleTreeUpdated);
      window.removeEventListener("plaza-toggle-collapse-all", collapsedAll);
    };
  }, [collapsedAll]);

  const isCollapsible = currentJson.some(
    (node) => Array.isArray(node.children) && node.children.length > 0,
  );
  const allCollapsibleKeys = getAllCollapsibleKeys(currentJson);
  const isAllCollapsed =
    allCollapsibleKeys.length === 0 ||
    allCollapsibleKeys.every((key) => collapsedKeys.has(key));

  return {
    containerRef,
    currentJson,
    persist,
    // Выбор и ховер
    clickedKey,
    setClickedKey,
    hoveredKey,
    setHoveredKey,
    // Сворачивание
    collapsedKeys,
    toggleCollapseKey,
    collapsedAll,
    isCollapsible,
    isAllCollapsed,
    // Удаление
    deleteNode,
    // История
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    handleUndo: history.handleUndo,
    handleRedo: history.handleRedo,
    // DnD
    draggedKey: dnd.draggedKey,
    dropTarget: dnd.dropTarget,
    dragMousePos: dnd.dragMousePos,
    draggedNode: dnd.draggedNode,
    hasDraggedRef: dnd.hasDraggedRef,
    startDrag: dnd.handlePointerDownNode,
  };
}
