"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Определение ориентации контейнера:
 * Если flex-row / row / flex без col -> РЯДОМ (в одну линию).
 * Если flex-col / column / по умолчанию -> В КОЛОНКУ (друг под другом).
 */
function isRowContainer(node: HtmlNode): boolean {
  const raw = (node.class || "").toLowerCase();
  const cls = raw.replace(/[-_]/g, " ");
  const style = (node.style || "").toLowerCase();

  // Если явно указана колонка
  if (
    raw.includes("flex-col") ||
    raw.includes("flex-column") ||
    cls.includes("flex col") ||
    cls.includes("flex column") ||
    style.includes("flex-direction: column")
  ) {
    return false;
  }

  // Если явно указана строка / ряд
  if (
    raw.includes("flex-row") ||
    cls.includes("flex row") ||
    raw.includes("ul-flex-row") ||
    raw.includes("grid") ||
    style.includes("flex-direction: row")
  ) {
    return true;
  }

  // Просто flex без указания col — по умолчанию строка
  if (raw.includes("flex") || style.includes("display: flex")) {
    return true;
  }

  return false;
}

// Палитра глубины кирпичиков
const DEPTH_BG = [
  "rgba(18, 18, 24, 0.96)", // depth 0
  "rgba(26, 26, 34, 0.96)", // depth 1
  "rgba(34, 34, 44, 0.96)", // depth 2
  "rgba(42, 42, 54, 0.96)", // depth 3
  "rgba(50, 50, 64, 0.96)", // depth 4+
];

const DEPTH_BORDER = [
  "rgba(63, 63, 70, 0.8)", // zinc-700
  "rgba(82, 82, 91, 0.85)", // zinc-600
  "rgba(113, 113, 122, 0.9)", // zinc-500
  "rgba(161, 161, 170, 0.9)", // zinc-400
  "rgba(212, 212, 216, 0.9)", // zinc-300
];

interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside";
}

interface NodeProps {
  node: HtmlNode;
  depth: number;
  parentIsRow?: boolean;
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
 * Интерактивный зазор (DropGap) между соседними кирпичиками.
 * Поддерживает вертикальный вид (в строке) и горизонтальный (в колонке).
 */
function DropGap({
  targetKey,
  position,
  orientation = "horizontal",
  draggedKey,
  dropTarget,
}: {
  targetKey: string;
  position: "before" | "after";
  orientation?: "horizontal" | "vertical";
  draggedKey: string | null;
  dropTarget: DropTarget | null;
}) {
  const isTarget =
    Boolean(draggedKey) &&
    dropTarget?.key === targetKey &&
    dropTarget?.position === position;

  const isVert = orientation === "vertical";

  return (
    <div
      data-gap-key={targetKey}
      data-gap-pos={position}
      className={`relative select-none flex items-center justify-center cursor-default shrink-0 ${
        isVert ? "w-2 h-full min-h-[30px] self-stretch" : "h-2 w-full"
      }`}
    >
      {draggedKey && (
        <div
          className={`absolute pointer-events-none z-20 ${
            isVert ? "inset-y-0 -left-1 -right-1" : "inset-x-0 -top-1 -bottom-1"
          }`}
        />
      )}

      {isTarget && (
        <div
          className={`absolute flex items-center pointer-events-none z-30 ${
            isVert ? "inset-y-0 flex-col" : "inset-x-0 flex-row"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] shrink-0" />
          <div
            className={`bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8] ${
              isVert ? "w-[2px] flex-1" : "h-[2px] flex-1"
            }`}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Служебный кирпичик ноды:
 * Сохраняет свой фирменный вид (шапка с бейджем, классами, текстом, сворачиванием),
 * а дочерние элементы выстраивает строго РЯДОМ (если flex-row) или В КОЛОНКУ (если flex-col).
 */
function NodeCard({
  node,
  depth,
  parentIsRow = false,
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
  const isRow = isRowContainer(node);

  // Стили рамок и подсветки кирпичика
  let borderStyle = DEPTH_BORDER[depthIdx];
  let bgStyle = DEPTH_BG[depthIdx];
  let shadowStyle = `0 1px 3px rgba(0, 0, 0, 0.4)`;

  if (isDrop && dropPos === "self") {
    borderStyle = "#c084fc"; // purple-400 (дублирование)
    bgStyle = "rgba(168, 85, 247, 0.22)";
    shadowStyle = "0 0 12px rgba(192, 132, 252, 0.4)";
  } else if (isDrop && dropPos === "inside") {
    borderStyle = "#38bdf8"; // sky blue (вставка внутрь)
    bgStyle = "rgba(56, 189, 248, 0.16)";
    shadowStyle = "0 0 10px rgba(56, 189, 248, 0.4)";
  } else if (isClicked) {
    borderStyle = "#818cf8"; // indigo-400
    bgStyle = "rgba(99, 102, 241, 0.2)";
    shadowStyle = "0 0 10px rgba(129, 140, 248, 0.35)";
  } else if (isHovered && !draggedKey) {
    borderStyle = "#a5b4fc"; // indigo-300
    bgStyle = "rgba(99, 102, 241, 0.1)";
  }

  // Цвета бейджа тега
  const tagLower = (node.tag || "div").toLowerCase();
  let tagBadgeClass = "bg-zinc-800/80 border-zinc-600/80 text-zinc-200";
  if (tagLower === "div") {
    tagBadgeClass = "bg-indigo-950/80 border-indigo-500/80 text-indigo-200";
  } else if (tagLower === "p") {
    tagBadgeClass = "bg-emerald-950/80 border-emerald-500/80 text-emerald-200";
  } else if (
    tagLower === "section" ||
    tagLower === "header" ||
    tagLower === "footer"
  ) {
    tagBadgeClass = "bg-amber-950/80 border-amber-500/80 text-amber-200";
  }

  const hasClass = Boolean(node.class && node.class.trim());
  const classStr = hasClass
    ? "." + node.class!.trim().replace(/\s+/g, " .")
    : "";
  const hasText = Boolean(node.text && node.text.trim());

  return (
    <div
      data-node-key={key}
      data-is-row={parentIsRow ? "true" : "false"}
      onPointerEnter={(e) => {
        e.stopPropagation();
        onHoverNode(key);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        onHoverNode(null);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onPointerDownNode(e, key);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClickNode(key);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClickNode(key);
      }}
      className={`relative rounded-md select-none border transition-all box-border min-h-[30px] flex flex-col cursor-grab active:cursor-grabbing ${
        isDragged ? "opacity-35 border-dashed" : "opacity-100"
      } ${parentIsRow ? "flex-1 min-w-[120px]" : "w-full"}`}
      style={{
        backgroundColor: bgStyle,
        borderColor: borderStyle,
        boxShadow: shadowStyle,
      }}
    >
      {/* Чувствительный краюшек "ДО" (слева если в строке, сверху если в колонке) */}
      {isDrop && dropPos === "before" && (
        <div
          className={`absolute z-30 pointer-events-none flex items-center ${
            parentIsRow
              ? "-left-[2px] top-0 bottom-0 flex-col"
              : "-top-[2px] left-0 right-0 flex-row"
          }`}
        >
          {/*<div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] shrink-0" />
          <div
            className={`bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8] ${
              parentIsRow ? "w-[2px] flex-1" : "h-[2px] flex-1"
            }`}
          />*/}
        </div>
      )}

      {/* Шапка кирпичика: тег, класс, текст, кнопка сворачивания */}
      <div className="h-[28px] px-2 flex items-center justify-between gap-1 rounded-t-md border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {/* Кнопка сворачивания [+] / [-] */}
          {hasChildren ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(key);
              }}
              className="w-4 h-4 rounded bg-zinc-900/90 border border-zinc-700 hover:border-zinc-500 text-cyan-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 transition"
              title={isCollapsed ? "Раскрыть" : "Свернуть"}
            >
              {isCollapsed ? "+" : "−"}
            </button>
          ) : (
            <div className="w-3 shrink-0" />
          )}

          {/* Бейдж тега */}
          <span
            className={`px-1.5 py-0.5 rounded text-[12px]  font-mono tracking-tight border uppercase shrink-0 leading-none ${tagBadgeClass}`}
          >
            {node.tag || "div"}
          </span>

          {/* Классы тега */}
          {hasClass && (
            <span
              className="text-[12px] font-mono text-lime-300  truncate max-w-[200px] leading-none"
              title={classStr}
            >
              {classStr}
            </span>
          )}

          {/* Текст тега */}
          {hasText && (
            <span
              className="text-[11px] text-zinc-200 truncate max-w-[180px] font-sans leading-none"
              title={node.text}
            >
              &quot;{node.text}&quot;
            </span>
          )}
        </div>

        {/*{/* Индикатор дублирования при drop на себя
        {isDrop && dropPos === "self" && (
          <span className="text-[9.5px] font-mono text-purple-300 font-semibold bg-purple-950/90 border border-purple-500/60 px-1 py-0.5 rounded shrink-0 animate-pulse leading-none">
            ✦ Duplicate
          </span>
        )}*/}
      </div>

      {/* Вложенные дочерние кирпичики: РЯДОМ в строку (если flex-row) или В КОЛОНКУ (если flex-col) */}
      {hasChildren && !isCollapsed && (
        <div
          className={`w-full flex-1 relative  ${
            isRow
              ? "flex flex-row flex-nowrap items-stretch gap-1 overflow-x-auto pb-2"
              : "flex flex-col gap-1 px-1 border-l border-zinc-700/60"
          }`}
        >
          {children.map((child, idx) => (
            <React.Fragment key={child._key || idx}>
              {idx === 0 && (
                <DropGap
                  targetKey={child._key || ""}
                  position="before"
                  orientation={isRow ? "vertical" : "horizontal"}
                  draggedKey={draggedKey}
                  dropTarget={dropTarget}
                />
              )}

              <NodeCard
                node={child}
                depth={depth + 1}
                parentIsRow={isRow}
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

              <DropGap
                targetKey={child._key || ""}
                position="after"
                orientation={isRow ? "vertical" : "horizontal"}
                draggedKey={draggedKey}
                dropTarget={dropTarget}
              />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Чувствительный краюшек "ПОСЛЕ" (справа если в строке, снизу если в колонке) */}
      {isDrop && dropPos === "after" && (
        <div
          className={`absolute z-30 pointer-events-none flex items-center ${
            parentIsRow
              ? "-right-[2px] top-0 bottom-0 flex-col"
              : "-bottom-[2px] left-0 right-0 flex-row"
          }`}
        >
          {/*<div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] shrink-0" />*/}
          {/*<div
            className={`bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8] ${
              parentIsRow ? "w-[2px] flex-1" : "h-[2px] flex-1"
            }`}
          />*/}
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
  // Глобальное отслеживание Drag & Drop: свободное перемещение в любую позицию
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

      // 3. Поиск элемента под курсором
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length === 0) {
        dropTargetRef.current = null;
        setDropTarget(null);
        return;
      }

      // Попадание в зазор (DropGap)
      const gapEl = elements
        .map((el) => el.closest("[data-gap-key]"))
        .find(Boolean) as HTMLElement | undefined;

      if (gapEl) {
        const key = gapEl.getAttribute("data-gap-key")!;
        const position = gapEl.getAttribute("data-gap-pos") as
          "before" | "after";

        // Если это зазор самого перетаскиваемого элемента - игнорируем
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

      // Поиск карточки кирпичика под курсором
      const cardEl = elements
        .map((el) => el.closest("[data-node-key]"))
        .find(Boolean) as HTMLElement | undefined;

      if (cardEl) {
        const key = cardEl.getAttribute("data-node-key")!;
        const isParentRow = cardEl.getAttribute("data-is-row") === "true";

        // Бросок на самого себя = дублирование
        if (key === activeDragKey) {
          const nextTarget: DropTarget = {
            key: activeDragKey,
            position: "self",
          };
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

      // Если курсор на пустом месте внизу холста — возможность бросить в конец списка
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

      // Немедленно и синхронно сбрасываем всё состояние перетаскивания
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
          // Дублирование ноды только при явном сбросе на самого себя
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
      <aside className="w-48 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex flex-col justify-between shadow-xl select-none overflow-hidden">
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

      {/* Рабочая область: Разметка кирпичиков */}
      <div
        ref={containerRef}
        onClick={() => setClickedKey(null)}
        className="plaza-workspace flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-auto  shadow-2xl custom-scrollbar"
      >
        {currentJson.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-zinc-500 gap-2">
            <span className="text-3xl">🧩</span>
            <p className="text-sm font-medium">Холст пуст</p>
            <p className="text-xs text-zinc-600 max-w-sm text-center">
              Выберите тег или компонент из боковой панели, чтобы начать
              построение схемы разметки.
            </p>
          </div>
        ) : (
          <div className="w-full  mx-auto flex flex-col min-h-full">
            {currentJson.map((node, index) => (
              <React.Fragment key={node._key || index}>
                {index === 0 && (
                  <DropGap
                    targetKey={node._key || ""}
                    position="before"
                    orientation="horizontal"
                    draggedKey={draggedKey}
                    dropTarget={dropTarget}
                  />
                )}

                <NodeCard
                  node={node}
                  depth={0}
                  parentIsRow={false}
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

                <DropGap
                  targetKey={node._key || ""}
                  position="after"
                  orientation="horizontal"
                  draggedKey={draggedKey}
                  dropTarget={dropTarget}
                />
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Плавающий "призрак" перетаскиваемой ноды со статусом действия */}
        {draggedNode && dragMousePos && (
          <div
            className="fixed pointer-events-none z-50 py-1.5 px-3 rounded-lg bg-indigo-950/95 border border-indigo-400 shadow-[0_10px_25px_rgba(0,0,0,0.6)] flex items-center gap-2 -translate-x-3 -translate-y-3 backdrop-blur-md"
            style={{
              left: dragMousePos.x,
              top: dragMousePos.y,
            }}
          >
            <span className="font-mono text-xs font-bold text-indigo-300 uppercase leading-none">
              {draggedNode.tag || "div"}
            </span>
            {dropTarget && (
              <span
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border leading-none ${
                  dropTarget.position === "self"
                    ? "bg-purple-950/80 border-purple-400 text-purple-200"
                    : "bg-sky-950/80 border-sky-400 text-sky-200"
                }`}
              >
                {dropTarget.position === "self"
                  ? "✦ Дублировать"
                  : dropTarget.position === "inside"
                    ? "↳ Внутрь"
                    : dropTarget.position === "before"
                      ? "↑ До"
                      : "↓ После"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
