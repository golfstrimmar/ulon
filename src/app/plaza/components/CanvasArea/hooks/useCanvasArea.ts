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
import {
  moveNodePosition,
  findNodeByKey,
  isDescendant,
  duplicateNodeInTree,
  deleteNodeFromArray,
  updateNodeByKey,
} from "@/lib/htmlTree";
import {
  extractStylesAndScriptsFromNodes,
  mergeScssWithoutDuplicates,
  mergeScriptsWithoutDuplicates,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";

import { styleHistory } from "@/lib/styleHistory";
import { scriptsHistory } from "@/lib/scriptsHistory";

export interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside";
}

// =================================
export function useCanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const currentJsonRef = useRef<HtmlNode[]>([]);
  currentJsonRef.current = currentJson;

  // История дерева HTML (Undo / Redo)
  const historyRef = useRef<HtmlNode[][]>([]);
  const futureRef = useRef<HtmlNode[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Выбор и навигация
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickedKey, setClickedKey] = useState<string | null>(null);
  const clickedKeyRef = useRef<string | null>(null);
  clickedKeyRef.current = clickedKey;

  // Редактирование ноды
  const [editTag, setEditTag] = useState<string>("div");
  const [editClass, setEditClass] = useState<string>("");
  const [editText, setEditText] = useState<string>("");

  // Drag and Drop
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
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Глобальные SCSS / JS
  const [globalScss, setGlobalScss] = useState<string>("");
  const globalScssRef = useRef<string>("");
  globalScssRef.current = globalScss;

  const [globalJs, setGlobalJs] = useState<string>("");
  const globalJsRef = useRef<string>("");
  globalJsRef.current = globalJs;

  // Нахождение выбранного элемента
  let selectedNode: HtmlNode | null = null;
  if (clickedKey) {
    for (const r of currentJson) {
      const f = findNodeByKey(r, clickedKey);
      if (f) {
        selectedNode = f;
        break;
      }
    }
  }

  // 🔹 Слушаем клики из PreviewArea (iframe)
  useEffect(() => {
    const handleSelectFromPreview = (e: any) => {
      const { key, className, tag, text } = e.detail || {};

      const findNode = (list: HtmlNode[]): HtmlNode | null => {
        for (const node of list) {
          if (key && node._key === key) return node;

          if (className && node.class) {
            const firstClass = className
              .trim()
              .split(/\s+/)[0]
              ?.replace(/^\./, "");
            if (firstClass && node.class.split(/\s+/).includes(firstClass)) {
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

          if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const targetNode = findNode(currentJsonRef.current);

      if (targetNode) {
        // 🛑 Если эта нода УЖЕ открыта — ничего не сбрасываем и не перетираем!
        if (targetNode._key === clickedKeyRef.current) return;

        setClickedKey(targetNode._key ?? null);
      }
    };

    window.addEventListener("plaza-node-selected", handleSelectFromPreview);

    return () => {
      window.removeEventListener(
        "plaza-node-selected",
        handleSelectFromPreview,
      );
    };
  }, []);

  // Синхронизация полей редактора при смене выбранной ноды
  useEffect(() => {
    if (selectedNode) {
      setEditTag(selectedNode.tag || "div");
      setEditClass(selectedNode.class || "");
      setEditText(selectedNode.text || "");
    }
  }, [clickedKey, selectedNode?._key]);

  // Сохранение стилей в БД и запись в историю
  const updateAndPersistScss = async (nextScss: string) => {
    try {
      styleHistory.record(nextScss);
      await saveGlobalScss(nextScss);
      setGlobalScss(nextScss);
      globalScssRef.current = nextScss;

      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: nextScss }),
      );
    } catch (e) {
      console.error("[useCanvasArea] Error saving SCSS to DB:", e);
    }
  };

  // Сохранение JS в БД и запись в историю
  const updateAndPersistJs = async (nextJs: string) => {
    try {
      scriptsHistory.record(nextJs);
      await saveGlobalJs(nextJs);
      setGlobalJs(nextJs);
      globalJsRef.current = nextJs;

      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: nextJs }),
      );
    } catch (e) {
      console.error("[useCanvasArea] Error saving JS:", e);
    }
  };

  // Сохранение разметки дерева (с историей дерева)
  const persist = async (next: HtmlNode[], recordHistory = true) => {
    if (recordHistory) {
      const snapshot = JSON.parse(JSON.stringify(currentJsonRef.current));
      historyRef.current = [...historyRef.current.slice(-49), snapshot];
      futureRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
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
        new CustomEvent("plaza-tree-updated", { detail: next }),
      );
    } catch (e) {
      console.error("[useCanvasArea] Persist error:", e);
    }
  };

  // Undo / Redo для дерева нод
  const handleUndo = useCallback(async () => {
    if (historyRef.current.length === 0) return;
    const previousState = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [
      JSON.parse(JSON.stringify(currentJsonRef.current)),
      ...futureRef.current,
    ];
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    await persist(previousState, false);
  }, []);

  const handleRedo = useCallback(async () => {
    if (futureRef.current.length === 0) return;
    const nextState = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    historyRef.current = [
      ...historyRef.current.slice(-49),
      JSON.parse(JSON.stringify(currentJsonRef.current)),
    ];
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
    await persist(nextState, false);
  }, []);

  // Горячие клавиши для холста
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;
      const key = e.key.toLowerCase();
      if ((key === "z" || key === "я") && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((key === "z" || key === "я") && e.shiftKey) ||
        key === "y" ||
        key === "н"
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Загрузка при монтировании
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
          currentJs = mergeScriptsWithoutDuplicates(
            currentJs,
            extractedScripts,
          );
        }

        setCurrentJson(cleanNodes);
        currentJsonRef.current = cleanNodes;

        styleHistory.init(currentScss);
        scriptsHistory.init(currentJs);

        await Promise.all([
          saveGlobalScss(currentScss),
          saveGlobalJs(currentJs),
          saveHtmlJson(DB_KEY, cleanNodes),
        ]);
      } else {
        setCurrentJson([]);
        currentJsonRef.current = [];
        styleHistory.init(currentScss);
        scriptsHistory.init(currentJs);

        await Promise.all([
          saveGlobalScss(currentScss),
          saveGlobalJs(currentJs),
        ]);
      }

      setGlobalScss(currentScss);
      globalScssRef.current = currentScss;
      setGlobalJs(currentJs);
      globalJsRef.current = currentJs;
    } catch (err) {
      console.error("[useCanvasArea] Mount error:", err);
    }
  };
  useEffect(() => {
    jsonDownload();
  }, []);

  // Слушатели шины событий
  useEffect(() => {
    const handleStyles = (e: Event) => {
      const customEvent = e as CustomEvent<string | Record<string, string>>;
      let nextScss = "";
      if (typeof customEvent.detail === "string") {
        nextScss = customEvent.detail;
      } else if (customEvent.detail && typeof customEvent.detail === "object") {
        nextScss = Object.values(customEvent.detail).join("\n\n");
      }
      setGlobalScss(nextScss);
      globalScssRef.current = nextScss;
    };

    const handleScripts = (e: Event) => {
      const customEvent = e as CustomEvent<string | Record<string, string>>;
      let nextJs = "";
      if (typeof customEvent.detail === "string") {
        nextJs = customEvent.detail;
      } else if (customEvent.detail && typeof customEvent.detail === "object") {
        nextJs =
          (customEvent.detail as any).__bundle__ ||
          Object.values(customEvent.detail).join("\n\n");
      }
      setGlobalJs(nextJs);
      globalJsRef.current = nextJs;
    };
    window.addEventListener("plaza-tree-updated", jsonDownload);
    window.addEventListener("plaza-styles-updated", handleStyles);
    window.addEventListener("plaza-scripts-updated", handleScripts);
    return () => {
      window.removeEventListener("plaza-styles-updated", handleStyles);
      window.removeEventListener("plaza-scripts-updated", handleScripts);
    };
  }, []);

  // Drag-and-Drop
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
  }, []);

  const handleAppendFromPath = async (path: string) => {
    try {
      const res = await fetch(path);
      if (!res.ok) return;
      const raw = await res.json();
      const nodes: HtmlNode[] = Array.isArray(raw) ? raw : [raw];

      const { cleanNodes, extractedScss, extractedScripts } =
        extractStylesAndScriptsFromNodes(nodes);

      if (extractedScss) {
        const nextScss = mergeScssWithoutDuplicates(
          globalScssRef.current,
          extractedScss,
        );
        if (nextScss !== globalScssRef.current) {
          await updateAndPersistScss(nextScss);
        }
      }

      if (extractedScripts.length > 0) {
        const nextBundle = mergeScriptsWithoutDuplicates(
          globalJsRef.current,
          extractedScripts,
        );
        if (nextBundle !== globalJsRef.current) {
          await updateAndPersistJs(nextBundle);
        }
      }

      const next = [...currentJsonRef.current, ...cleanNodes];
      await persist(next);
    } catch (e) {
      console.error(`Error adding from ${path}:`, e);
    }
  };

  const handleClear = async () => {
    await persist([]);
    setClickedKey(null);
    setHoveredKey(null);
  };

  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  };

  const handlePointerDownNode = (e: React.PointerEvent, key: string) => {
    if (e.button !== 0) return;
    potentialDragKeyRef.current = key;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
  };

  const handleToggleCollapse = (key: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleClickNode = (key: string) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      setClickedKey(key);
      clickTimeoutRef.current = null;
    }, 200);
  };

  const handleDoubleClickNode = async (key: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    const next = deleteNodeFromArray(currentJsonRef.current, key);
    if (clickedKey === key) setClickedKey(null);
    if (hoveredKey === key) setHoveredKey(null);
    await persist(next);
  };

  const handleSaveNodeField = async (
    field: "tag" | "class" | "text" | "attributes",
    value: any,
  ) => {
    if (!clickedKey) return;
    const patch: Partial<HtmlNode> = { [field]: value };
    const next = currentJsonRef.current.map((root) =>
      updateNodeByKey(root, clickedKey, patch),
    );
    await persist(next);
  };

  const handleSaveScriptJs = async (targetName: string, jsCode: string) => {
    const nextBundle = mergeScriptsWithoutDuplicates(globalJsRef.current, [
      { name: targetName, code: jsCode },
    ]);
    await updateAndPersistJs(nextBundle);
  };

  const handleAddClassToNode = async (newCls: string) => {
    const clean = newCls.trim().replace(/^\./, "");
    if (!clean || !clickedKey || !selectedNode) return;

    const currentClasses = (selectedNode.class || "")
      .split(/\s+/)
      .filter(Boolean);
    if (!currentClasses.includes(clean)) {
      const updatedClassStr = [...currentClasses, clean].join(" ");
      setEditClass(updatedClassStr);
      await handleSaveNodeField("class", updatedClassStr);
    }
  };

  let draggedNode: HtmlNode | null = null;
  if (draggedKey) {
    for (const r of currentJson) {
      const f = findNodeByKey(r, draggedKey);
      if (f) {
        draggedNode = f;
        break;
      }
    }
  }
  // Если у любого из корневых узлов есть дети — дерево имеет вложенность!
  function canCollapse(nodes: HtmlNode[] | null | undefined): boolean {
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return false;
    }
    return nodes.some(
      (node) => Array.isArray(node.children) && node.children.length > 0,
    );
  }
  const isCollapsible = canCollapse(currentJson);
  /**
   * 🔹 Рекурсивно собирает ключи (_key) всех узлов, имеющих потомков
   */
  function getAllCollapsibleKeys(
    nodes: HtmlNode[] | null | undefined,
  ): string[] {
    if (!nodes || !Array.isArray(nodes)) return [];

    const keys: string[] = [];

    function traverse(list: HtmlNode[]) {
      for (const node of list) {
        if (Array.isArray(node.children) && node.children.length > 0) {
          if (node._key) {
            keys.push(node._key);
          }
          // Идем вглубь дерева
          traverse(node.children);
        }
      }
    }

    traverse(nodes);
    return keys;
  }
  const allCollapsibleKeys = getAllCollapsibleKeys(currentJson);
  // ✅ Сворачиваем ключи
  const collapsedAll = () => {
    setCollapsedKeys(new Set(allCollapsibleKeys));
  };

  const isAllCollapsed =
    allCollapsibleKeys.length === 0 ||
    allCollapsibleKeys.every((key) => collapsedKeys.has(key));

  return {
    containerRef,
    currentJson,
    canUndo,
    canRedo,
    openFolders,
    collapsedKeys,
    hoveredKey,
    clickedKey,
    selectedNode,
    draggedKey,
    dropTarget,
    dragMousePos,
    draggedNode,
    globalScss,
    globalJs,
    editTag,
    editClass,
    editText,
    setEditTag,
    setEditClass,
    setEditText,
    setHoveredKey,
    setClickedKey,
    handleUndo,
    handleRedo,
    handleClear,
    toggleFolder,
    handleAppendFromPath,
    handlePointerDownNode,
    handleToggleCollapse,
    handleClickNode,
    handleDoubleClickNode,
    handleSaveNodeField,
    handleSaveScriptJs,
    handleAddClassToNode,
    updateAndPersistScss,
    isCollapsible,
    collapsedAll,
    isAllCollapsed,
  };
}
