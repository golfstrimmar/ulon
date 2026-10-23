"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { getHtmlJson, saveHtmlJson, deleteHtmlJson } from "@/lib/htmlStorage";
import {
  generateNodeKey,
  moveNodePosition,
  findNodeByKey,
  isDescendant,
  duplicateNodeInTree,
  deleteNodeFromArray,
} from "@/lib/htmlTree";
import { ROOT_TAGS, ELEMENT_FOLDERS } from "./elementsManifest";

const DB_KEY = "plaza_tree";

/**
 * Рекурсивное присвоение уникальных _key для загружаемого фрагмента
 */
function assignKeys(node: HtmlNode): HtmlNode {
  return {
    ...node,
    _key: generateNodeKey(),
    children: Array.isArray(node.children)
      ? node.children.map(assignKeys)
      : node.children || [],
  };
}

// Палитра глубины для кирпичиков
const DEPTH_BG = [
  "rgba(18, 18, 23, 0.96)", // depth 0: основание
  "rgba(26, 26, 32, 0.96)", // depth 1: блок поверх основания
  "rgba(34, 34, 42, 0.96)", // depth 2: блок поверх первого
  "rgba(42, 42, 52, 0.96)", // depth 3: блок поверх второго
  "rgba(50, 50, 62, 0.96)", // depth 4+
];

const DEPTH_BORDER = [
  "rgba(63, 63, 70, 0.75)", // zinc-700
  "rgba(82, 82, 91, 0.8)", // zinc-600
  "rgba(113, 113, 122, 0.85)", // zinc-500
  "rgba(161, 161, 170, 0.85)", // zinc-400
  "rgba(212, 212, 216, 0.85)", // zinc-300
];

interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside";
}

interface NodeProps {
  node: HtmlNode;
  depth: number;
  draggedKey: string | null;
  dropTarget: DropTarget | null;
  collapsedKeys: Set<string>;
  clickedKey: string | null;
  hoveredKey: string | null;
  onPointerDownNode: (e: React.PointerEvent, key: string) => void;
  onClickNode: (key: string) => void;
  onDoubleClickNode: (key: string) => void;
  onToggleCollapse: (key: string) => void;
  onHoverNode: (key: string | null) => void;
}

/**
 * Компактный зазор между кирпичиками.
 * Фиксированная высота h-1.5, 0 дерганий (layout shift).
 */
function DropGap({
  targetKey,
  position,
  draggedKey,
  dropTarget,
}: {
  targetKey: string;
  position: "before" | "after";
  draggedKey: string | null;
  dropTarget: DropTarget | null;
}) {
  const isTarget =
    Boolean(draggedKey) &&
    dropTarget?.key === targetKey &&
    dropTarget?.position === position;

  return (
    <div
      data-gap-key={targetKey}
      data-gap-pos={position}
      className="relative h-1.5 w-full select-none flex items-center justify-center cursor-default"
    >
      {/* Невидимая расширенная область захвата для курсора */}
      {draggedKey && (
        <div className="absolute inset-x-0 -top-1 -bottom-1 z-20 cursor-crosshair pointer-events-none" />
      )}

      {/* Светящаяся полоса-индикатор с маркером при наведении на зазор */}
      {isTarget && (
        <div className="absolute inset-x-0 flex items-center pointer-events-none z-30">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] mr-1 shrink-0" />
          <div className="flex-1 h-[2px] bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8]" />
        </div>
      )}
    </div>
  );
}

/**
 * Компактный служебный кирпичик ноды с чувствительными краюшками для сброса
 */
function NodeCard({
  node,
  depth,
  draggedKey,
  dropTarget,
  collapsedKeys,
  clickedKey,
  hoveredKey,
  onPointerDownNode,
  onClickNode,
  onDoubleClickNode,
  onToggleCollapse,
  onHoverNode,
}: NodeProps) {
  const key = node._key || "";
  const children = Array.isArray(node.children)
    ? (node.children as HtmlNode[])
    : [];
  const hasChildren = children.length > 0;
  const isCollapsed = collapsedKeys.has(key);

  const isDragged = draggedKey === key;
  const isHovered = hoveredKey === key;
  const isClicked = clickedKey === key;
  const isDrop = dropTarget?.key === key;
  const dropPos = isDrop ? dropTarget?.position : null;

  const depthIdx = Math.min(depth, DEPTH_BG.length - 1);

  // Стили рамок и подсветки кирпичика
  let borderStyle = DEPTH_BORDER[depthIdx];
  let bgStyle = DEPTH_BG[depthIdx];
  let shadowStyle = `0 1px 3px rgba(0, 0, 0, 0.35)`;

  if (isDrop && dropPos === "self") {
    borderStyle = "#c084fc"; // purple-400 (дублирование)
    bgStyle = "rgba(168, 85, 247, 0.22)";
    shadowStyle = "0 0 12px rgba(192, 132, 252, 0.4)";
  } else if (isDrop && dropPos === "inside") {
    borderStyle = "#38bdf8"; // sky blue (сброс внутрь ноды)
    bgStyle = "rgba(56, 189, 248, 0.14)";
    shadowStyle = "0 0 10px rgba(56, 189, 248, 0.35)";
  } else if (isClicked) {
    borderStyle = "#818cf8"; // indigo-400
    bgStyle = "rgba(99, 102, 241, 0.2)";
    shadowStyle = "0 0 10px rgba(129, 140, 248, 0.35)";
  } else if (isHovered && !draggedKey) {
    borderStyle = "#a5b4fc"; // indigo-300
    bgStyle = "rgba(99, 102, 241, 0.1)";
  }

  // Цвета тегов
  const tagLower = (node.tag || "div").toLowerCase();
  let tagBadgeClass = "bg-zinc-800/80 border-zinc-600/80 text-zinc-200";
  if (tagLower === "div") {
    tagBadgeClass = "bg-indigo-950/80 border-indigo-500/80 text-indigo-200";
  } else if (tagLower === "p") {
    tagBadgeClass = "bg-emerald-950/80 border-emerald-500/80 text-emerald-200";
  }

  const hasClass = Boolean(node.class && node.class.trim());
  const classStr = hasClass
    ? "." + node.class!.trim().replace(/\s+/g, " .")
    : "";
  const hasText = Boolean(node.text && node.text.trim());

  return (
    <div
      data-node-key={key}
      onPointerEnter={() => onHoverNode(key)}
      onPointerLeave={() => onHoverNode(null)}
      className={`relative rounded-md select-none border transition-colors ${
        isDragged ? "opacity-35 border-dashed" : "opacity-100"
      }`}
      style={{
        backgroundColor: bgStyle,
        borderColor: borderStyle,
        boxShadow: shadowStyle,
      }}
    >
      {/* Чувствительный верхний краюшек: линия сброса "ДО" */}
      {isDrop && dropPos === "before" && (
        <div className="absolute -top-[2px] left-0 right-0 z-30 flex items-center pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] mr-1 shrink-0" />
          <div className="flex-1 h-[2px] bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8]" />
        </div>
      )}

      {/* Компактная шапка кирпичика (28px) */}
      <div
        onPointerDown={(e) => onPointerDownNode(e, key)}
        onClick={(e) => {
          e.stopPropagation();
          onClickNode(key);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClickNode(key);
        }}
        className="h-[28px] px-2 flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing rounded-t-md"
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {/* Кнопка сворачивания [+] / [-] */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(key);
              }}
              className="w-4 h-4 rounded bg-zinc-900/90 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0 transition"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? "+" : "−"}
            </button>
          ) : (
            <div className="w-4 shrink-0" />
          )}

          {/* Компактный бейдж тега */}
          <span
            className={`px-1.5 py-0.5 rounded text-[12px] font-mono  tracking-tight border uppercase shrink-0 leading-none ${tagBadgeClass}`}
          >
            {node.tag || "div"}
          </span>

          {/* Классы тега */}
          {hasClass && (
            <span
              className="text-[14px] font-mono text-cyan-400 truncate max-w-[240px] leading-none"
              title={classStr}
            >
              {classStr}
            </span>
          )}

          {/* Текст тега */}
          {hasText && (
            <span
              className="text-[11px] text-zinc-200 truncate max-w-[220px] font-sans leading-none"
              title={node.text}
            >
              &quot;{node.text}&quot;
            </span>
          )}
        </div>

        {/* Подсказка дублирования при drop на себя */}
        {isDrop && dropPos === "self" && (
          <span className="text-[9.5px] font-mono text-purple-300 font-semibold bg-purple-950/80 border border-purple-500/60 px-1 py-0.5 rounded shrink-0 animate-pulse leading-none">
            ✦ Duplicate
          </span>
        )}
      </div>

      {/* Вложенные кирпичики-потомки */}
      {hasChildren && !isCollapsed && (
        <div className="px-2 pb-1.5 pt-0.5">
          <div className="pl-1.5 border-l border-zinc-700/60 flex flex-col">
            {children.map((child, idx) => (
              <div key={child._key || idx}>
                {/* Зазор перед первым элементом */}
                {idx === 0 && (
                  <DropGap
                    targetKey={child._key || ""}
                    position="before"
                    draggedKey={draggedKey}
                    dropTarget={dropTarget}
                  />
                )}

                <NodeCard
                  node={child}
                  depth={depth + 1}
                  draggedKey={draggedKey}
                  dropTarget={dropTarget}
                  collapsedKeys={collapsedKeys}
                  clickedKey={clickedKey}
                  hoveredKey={hoveredKey}
                  onPointerDownNode={onPointerDownNode}
                  onClickNode={onClickNode}
                  onDoubleClickNode={onDoubleClickNode}
                  onToggleCollapse={onToggleCollapse}
                  onHoverNode={onHoverNode}
                />

                {/* Зазор после каждого элемента */}
                <DropGap
                  targetKey={child._key || ""}
                  position="after"
                  draggedKey={draggedKey}
                  dropTarget={dropTarget}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Чувствительный нижний краюшек: линия сброса "ПОСЛЕ" */}
      {isDrop && dropPos === "after" && (
        <div className="absolute -bottom-[2px] left-0 right-0 z-30 flex items-center pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] mr-1 shrink-0" />
          <div className="flex-1 h-[2px] bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8]" />
        </div>
      )}
    </div>
  );
}

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);

  // В базе изначально пустота
  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const currentJsonRef = useRef<HtmlNode[]>([]);
  currentJsonRef.current = currentJson;

  // Стек истории для Undo / Redo
  const historyRef = useRef<HtmlNode[][]>([]);
  const futureRef = useRef<HtmlNode[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Состояние раскрытых папок в боковой панели
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickedKey, setClickedKey] = useState<string | null>(null);

  // Drag & drop состояния
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

  // 1. Чтение из IndexedDB при старте
  useEffect(() => {
    (async () => {
      try {
        const data = await getHtmlJson(DB_KEY);
        if (data) {
          const list = Array.isArray(data) ? data : [data];
          setCurrentJson(list);
          currentJsonRef.current = list;
        } else {
          setCurrentJson([]);
          currentJsonRef.current = [];
        }
      } catch (err) {
        console.error("IndexedDB error:", err);
        setCurrentJson([]);
      }
    })();
  }, []);

  // Сохранение состояния в IndexedDB и запись в историю Undo
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
    } catch (e) {
      console.error("Failed to save to IndexedDB:", e);
    }
  };

  // --------------------------------------------------------------------------
  // UNDO & REDO
  // --------------------------------------------------------------------------

  const handleUndo = useCallback(async () => {
    if (historyRef.current.length === 0) return;

    const previousState = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);

    const currentSnapshot = JSON.parse(JSON.stringify(currentJsonRef.current));
    futureRef.current = [currentSnapshot, ...futureRef.current];

    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);

    await persist(previousState, false);
  }, []);

  const handleRedo = useCallback(async () => {
    if (futureRef.current.length === 0) return;

    const nextState = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);

    const currentSnapshot = JSON.parse(JSON.stringify(currentJsonRef.current));
    historyRef.current = [...historyRef.current.slice(-49), currentSnapshot];

    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);

    await persist(nextState, false);
  }, []);

  // Глобальные горячие клавиши: Ctrl+Z / Cmd+Z (Undo) и Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

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

  // Загрузка любого JSON-файла по пути и добавление в конец
  const handleAppendFromPath = async (path: string) => {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        console.error(`Failed to fetch ${path}`);
        return;
      }
      const raw = await res.json();
      const nodes: HtmlNode[] = Array.isArray(raw) ? raw : [raw];
      const withKeys = nodes.map(assignKeys);

      const next = [...currentJsonRef.current, ...withKeys];
      await persist(next);
    } catch (e) {
      console.error(`Error adding from ${path}:`, e);
    }
  };

  // Очистка базы и холста
  const handleClear = async () => {
    await persist([]);
    setClickedKey(null);
    setHoveredKey(null);
  };

  // Переключение состояния папки (раскрыть / скрыть)
  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  };

  // --------------------------------------------------------------------------
  // Интерактивные действия с кирпичиками
  // --------------------------------------------------------------------------

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
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setClickedKey((prev) => (prev === key ? null : key));
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

  // --------------------------------------------------------------------------
  // Глобальное отслеживание Drag & Drop с честным hit-testing как в Canvas
  // --------------------------------------------------------------------------

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // 1. Порог перетаскивания (4px)
      if (potentialDragKeyRef.current && dragStartPosRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 4) {
          draggedKeyRef.current = potentialDragKeyRef.current;
          setDraggedKey(potentialDragKeyRef.current);
          potentialDragKeyRef.current = null;
          hasDraggedRef.current = true;
        }
      }

      const activeDragKey = draggedKeyRef.current;
      if (!activeDragKey) return;

      // 2. Обновление координат курсора для "призрака"
      setDragMousePos({ x: e.clientX, y: e.clientY });

      // 3. Честный поиск элемента под курсором (через elementFromPoint)
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) {
        dropTargetRef.current = null;
        setDropTarget(null);
        return;
      }

      // Проверка попадания в зазор
      const gapEl = el.closest("[data-gap-key]");
      if (gapEl) {
        const key = gapEl.getAttribute("data-gap-key")!;
        const position = gapEl.getAttribute("data-gap-pos") as
          "before" | "after";
        const nextTarget: DropTarget = { key, position };
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
        return;
      }

      // Проверка попадания на сам кирпичик (ноду)
      const cardEl = el.closest("[data-node-key]");
      if (cardEl) {
        const key = cardEl.getAttribute("data-node-key")!;

        // Бросок на самого себя = дублирование
        if (key === activeDragKey) {
          const nextTarget: DropTarget = { key, position: "self" };
          dropTargetRef.current = nextTarget;
          setDropTarget(nextTarget);
          return;
        }

        // Запрет сброса внутрь своих потомков
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
        const relY = (e.clientY - rect.top) / rect.height;

        // Чувствительные краюшки ноды:
        // Верхний краюшек (< 0.28) -> до (before)
        // Нижний краюшек (> 0.72) -> после (after)
        // Середина (между краюшками) -> внутрь (inside)
        let position: "before" | "inside" | "after" = "inside";
        if (relY < 0.28) {
          position = "before";
        } else if (relY > 0.72) {
          position = "after";
        } else {
          position = "inside";
        }

        const nextTarget: DropTarget = { key, position };
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
        return;
      }

      dropTargetRef.current = null;
      setDropTarget(null);
    };

    const handlePointerUp = async () => {
      const activeDragKey = draggedKeyRef.current;

      if (activeDragKey) {
        const target = dropTargetRef.current;

        if (target && target.key) {
          if (target.key === activeDragKey || target.position === "self") {
            // Дублирование ноды
            const updated = duplicateNodeInTree(
              currentJsonRef.current,
              activeDragKey,
            );
            await persist(updated);
          } else {
            // Перемещение ноды (before / after / inside)
            const updated = moveNodePosition(
              currentJsonRef.current,
              activeDragKey,
              target.key,
              target.position,
            );
            await persist(updated);
          }
        }

        draggedKeyRef.current = null;
        setDraggedKey(null);
        dropTargetRef.current = null;
        setDropTarget(null);
        setDragMousePos(null);
        potentialDragKeyRef.current = null;
        dragStartPosRef.current = null;
        return;
      }

      potentialDragKeyRef.current = null;
      dragStartPosRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  // Найти текущий перетаскиваемый узел для отображения в "призраке"
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

  return (
    <div className="w-full flex gap-1 h-[calc(100vh-80px)] min-h-[500px] select-none">
      {/* Боковая панель с кнопками и папками */}
      <aside className="w-48 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex flex-col justify-between shadow-xl select-none overflow-hidden">
        {/* Верхняя часть: История + элементы */}
        <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
          {/* Блок Undo / Redo */}
          <div className="space-y-1 border-b border-zinc-800 pb-2">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <span>↶</span> Undo
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className="py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
              >
                <span>↷</span> Redo
              </button>
            </div>
          </div>

          {/* Вложенные папки категорий */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
              Folders
            </span>
            <div className="space-y-1">
              {ELEMENT_FOLDERS.map((folder) => {
                const isOpen = openFolders.has(folder.name);
                return (
                  <div key={folder.name} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleFolder(folder.name)}
                      className="w-full py-1 px-2 rounded bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{isOpen ? "📂" : "📁"}</span>
                        <span className="font-mono">{folder.name}</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="pl-3 py-0.5 space-y-1 border-l border-zinc-800/80">
                        <div className="flex flex-col gap-1">
                          {folder.items.map((item) => (
                            <button
                              type="button"
                              key={item.path}
                              onClick={() => handleAppendFromPath(item.path)}
                              className="w-full py-0.5 px-1.5 text-left text-[10px] font-mono rounded bg-zinc-800/60 hover:bg-zinc-700 hover:text-white border border-zinc-750 text-zinc-300 truncate transition cursor-pointer"
                              title={`Add ${item.name}`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Базовые теги (плотная сетка из 2 колонок) */}
          <div className="space-y-1 pt-1.5 border-t border-zinc-800">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
              Tags
            </span>
            <div className="grid grid-cols-2 gap-1">
              {ROOT_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag.path}
                  onClick={() => handleAppendFromPath(tag.path)}
                  className="py-0.5 px-1 text-[11px] font-bold rounded bg-zinc-700/70 hover:bg-zinc-700 hover:text-white border border-zinc-750 text-zinc-300 truncate text-center transition cursor-pointer"
                  title={`Add <${tag.name}>`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Нижняя часть: Clear Canvas */}
        {currentJson.length > 0 && (
          <div className="pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleClear}
              className="w-full py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-[11px] font-medium transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </aside>

      {/* Рабочая область: компактная структура кирпичиков */}
      <div
        ref={containerRef}
        onClick={() => setClickedKey(null)}
        className="flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-auto p-1 shadow-2xl custom-scrollbar"
      >
        {currentJson.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-zinc-500 gap-2">
            <span className="text-3xl">🧩</span>
          </div>
        ) : (
          <div className="w-full mx-auto flex flex-col">
            {currentJson.map((node, index) => (
              <div key={node._key || index}>
                {/* Зазор перед первой корневой нодой */}
                {index === 0 && (
                  <DropGap
                    targetKey={node._key || ""}
                    position="before"
                    draggedKey={draggedKey}
                    dropTarget={dropTarget}
                  />
                )}

                <NodeCard
                  node={node}
                  depth={0}
                  draggedKey={draggedKey}
                  dropTarget={dropTarget}
                  collapsedKeys={collapsedKeys}
                  clickedKey={clickedKey}
                  hoveredKey={hoveredKey}
                  onPointerDownNode={handlePointerDownNode}
                  onClickNode={handleClickNode}
                  onDoubleClickNode={handleDoubleClickNode}
                  onToggleCollapse={handleToggleCollapse}
                  onHoverNode={setHoveredKey}
                />

                {/* Зазор после каждой корневой ноды */}
                <DropGap
                  targetKey={node._key || ""}
                  position="after"
                  draggedKey={draggedKey}
                  dropTarget={dropTarget}
                />
              </div>
            ))}
          </div>
        )}

        {/* Компактный плавающий "призрак" перетаскиваемой ноды возле курсора */}
        {draggedNode && dragMousePos && (
          <div
            className="fixed pointer-events-none z-50 py-1 px-2.5 rounded-md bg-indigo-950/95 border border-indigo-400 shadow-[0_8px_20px_rgba(0,0,0,0.6)] flex items-center gap-1.5 -translate-x-2 -translate-y-2 backdrop-blur-sm"
            style={{
              left: dragMousePos.x,
              top: dragMousePos.y,
            }}
          >
            <span className="font-mono text-[10px] font-bold text-indigo-300 uppercase leading-none">
              {draggedNode.tag || "div"}
            </span>
            {draggedNode.text && (
              <span className="text-[11px] text-indigo-100 max-w-[120px] truncate leading-none">
                &quot;{draggedNode.text}&quot;
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
