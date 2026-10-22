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
import handleRender from "./utils/handleRender";
import type { RenderBox } from "./utils/types";

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

export function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef<RenderBox[]>([]);

  // В базе изначально пустота
  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const currentJsonRef = useRef<HtmlNode[]>([]);
  currentJsonRef.current = currentJson;

  // Стек истории для Undo / Redo
  const historyRef = useRef<HtmlNode[][]>([]);
  const futureRef = useRef<HtmlNode[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickedKey, setClickedKey] = useState<string | null>(null);

  // Drag & drop Refs
  const draggedKeyRef = useRef<string | null>(null);
  const dropTargetRef = useRef<{
    key: string;
    position: "inside" | "self" | "before" | "after";
  } | null>(null);
  const dragMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const potentialDraggedKeyRef = useRef<string | null>(null);
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

  // 2. Механизм рендеринга на canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    handleRender(
      canvas,
      ctx,
      boxesRef,
      currentJsonRef.current,
      hoveredKey,
      draggedKeyRef.current,
      dropTargetRef.current,
      dragMousePosRef.current,
      collapsedKeys,
      clickedKey,
      false,
      null,
      0
    );
  }, [hoveredKey, clickedKey, collapsedKeys]);

  useEffect(() => {
    render();
  }, [currentJson, render]);

  useEffect(() => {
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [render]);

  // Сохранение состояния в IndexedDB и запись в историю Undo
  const persist = async (next: HtmlNode[], recordHistory = true) => {
    if (recordHistory) {
      // Сохраняем снимок текущего состояния в стек истории
      const snapshot = JSON.parse(JSON.stringify(currentJsonRef.current));
      historyRef.current = [...historyRef.current.slice(-49), snapshot];
      futureRef.current = []; // Любое новое действие очищает стек Redo
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

    // Восстанавливаем состояние и синхронизируем базу
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

    // Восстанавливаем состояние и синхронизируем базу
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

      // Undo: Ctrl+Z / Cmd+Z (латиница z или русская я)
      if ((key === "z" || key === "я") && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z или Ctrl+Y (латиница y или русская н)
      else if (
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

  // Добавление узла из /public/json/[tag].json в конец (одна под другой)
  const handleAppendNode = async (tag: "div" | "p") => {
    try {
      const res = await fetch(`/json/${tag}.json`);
      if (!res.ok) {
        console.error(`Failed to fetch /json/${tag}.json`);
        return;
      }
      const raw = await res.json();
      const nodes: HtmlNode[] = Array.isArray(raw) ? raw : [raw];
      const withKeys = nodes.map(assignKeys);

      const next = [...currentJsonRef.current, ...withKeys];
      await persist(next);
    } catch (e) {
      console.error(`Error adding ${tag}:`, e);
    }
  };

  // Очистка базы и холста
  const handleClear = async () => {
    await persist([]);
    setClickedKey(null);
    setHoveredKey(null);
  };

  // --------------------------------------------------------------------------
  // Drag & Drop события мыши
  // --------------------------------------------------------------------------

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (hoveredKey) {
      potentialDraggedKeyRef.current = hoveredKey;
      dragStartPosRef.current = { x, y };
      hasDraggedRef.current = false;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 1. Порог перетаскивания (4px)
    if (potentialDraggedKeyRef.current && dragStartPosRef.current) {
      const dx = x - dragStartPosRef.current.x;
      const dy = y - dragStartPosRef.current.y;
      if (Math.hypot(dx, dy) > 4) {
        draggedKeyRef.current = potentialDraggedKeyRef.current;
        potentialDraggedKeyRef.current = null;
        hasDraggedRef.current = true;
      }
    }

    // 2. Режим Drag
    if (draggedKeyRef.current) {
      dragMousePosRef.current = { x, y };

      const draggedSourceKey = draggedKeyRef.current;
      let targetUnderCursor: {
        key: string;
        position: "inside" | "self" | "before" | "after";
      } | null = null;

      for (let i = boxesRef.current.length - 1; i >= 0; i--) {
        const box = boxesRef.current[i];
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          // Сброс на самого себя -> позиция "self" (дублирование)
          if (box.key === draggedSourceKey) {
            targetUnderCursor = { key: box.key, position: "self" };
            break;
          }

          let sourceNode: HtmlNode | null = null;
          for (const rootNode of currentJsonRef.current) {
            const f = findNodeByKey(rootNode, draggedSourceKey);
            if (f) {
              sourceNode = f;
              break;
            }
          }

          // Защита: нельзя бросать в своих потомков
          if (sourceNode && !isDescendant(sourceNode, box.key)) {
            const relY = (y - box.y) / box.h;
            let position: "before" | "inside" | "after" = "inside";
            if (relY < 0.25) {
              position = "before";
            } else if (relY > 0.75) {
              position = "after";
            } else {
              position = "inside";
            }
            targetUnderCursor = { key: box.key, position };
            break;
          }
        }
      }

      dropTargetRef.current = targetUnderCursor;
      render();
      return;
    }

    // 3. Обычный hover
    let foundKey: string | null = null;
    for (let i = boxesRef.current.length - 1; i >= 0; i--) {
      const box = boxesRef.current[i];
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        foundKey = box.key;
        break;
      }
    }

    if (foundKey !== hoveredKey) {
      setHoveredKey(foundKey);
    }
  };

  const handleMouseUp = async () => {
    if (draggedKeyRef.current) {
      const sourceKey = draggedKeyRef.current;
      const target = dropTargetRef.current;

      if (target && target.key) {
        if (target.key === sourceKey || target.position === "self") {
          // Сброс на самого себя -> дублируем ноду
          const updatedTree = duplicateNodeInTree(
            currentJsonRef.current,
            sourceKey
          );
          await persist(updatedTree);
        } else {
          // Сброс before / after / inside
          const updatedTree = moveNodePosition(
            currentJsonRef.current,
            sourceKey,
            target.key,
            target.position as "before" | "after" | "inside"
          );
          await persist(updatedTree);
        }
      }

      draggedKeyRef.current = null;
      dropTargetRef.current = null;
      dragMousePosRef.current = null;
      potentialDraggedKeyRef.current = null;
      dragStartPosRef.current = null;
      render();
      return;
    }

    potentialDraggedKeyRef.current = null;
    dragStartPosRef.current = null;
  };

  // Двойной клик: удаление ноды
  const handleDoubleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let keyToDelete: string | null = null;
    for (let i = boxesRef.current.length - 1; i >= 0; i--) {
      const box = boxesRef.current[i];
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        keyToDelete = box.key;
        break;
      }
    }

    if (keyToDelete) {
      const next = deleteNodeFromArray(currentJsonRef.current, keyToDelete);
      if (clickedKey === keyToDelete) setClickedKey(null);
      if (hoveredKey === keyToDelete) setHoveredKey(null);
      await persist(next);
    }
  };

  const handleMouseLeave = () => {
    draggedKeyRef.current = null;
    dropTargetRef.current = null;
    dragMousePosRef.current = null;
    potentialDraggedKeyRef.current = null;
    dragStartPosRef.current = null;
    if (hoveredKey) setHoveredKey(null);
    render();
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Сворачивание / разворачивание ветки
    for (const box of boxesRef.current) {
      if (box.toggleBtnBounds) {
        const tb = box.toggleBtnBounds;
        if (x >= tb.x && x <= tb.x + tb.w && y >= tb.y && y <= tb.y + tb.h) {
          setCollapsedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(box.key)) next.delete(box.key);
            else next.add(box.key);
            return next;
          });
          return;
        }
      }
    }

    // Задержка на одинарный клик, чтобы не конфликтовать с даблкликом
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = setTimeout(() => {
      let clicked: string | null = null;
      for (let i = boxesRef.current.length - 1; i >= 0; i--) {
        const b = boxesRef.current[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          clicked = b.key;
          break;
        }
      }
      setClickedKey(clicked);
      clickTimeoutRef.current = null;
    }, 200);
  };

  return (
    <div className="w-full flex gap-4 h-[calc(100vh-120px)] min-h-[500px]">
      {/* Боковая панель с кнопками */}
      <aside className="w-44 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between shadow-xl select-none">
        <div className="space-y-4">
          {/* Блок Undo / Redo */}
          <div className="space-y-1.5 border-b border-zinc-800 pb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
              History
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <span>↶</span> Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
              >
                <span>↷</span> Redo
              </button>
            </div>
          </div>

          {/* Блок добавления элементов */}
          <div className="space-y-2">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                Elements
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                from /public/json
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleAppendNode("div")}
                className="w-full py-2 px-3 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 hover:border-indigo-500 text-indigo-300 hover:text-white font-mono text-xs font-semibold flex items-center justify-between transition cursor-pointer shadow-sm"
                title="Add div to end"
              >
                <span>&lt;div&gt;</span>
                <span className="text-[10px] text-indigo-400/80 font-sans">+ add</span>
              </button>

              <button
                onClick={() => handleAppendNode("p")}
                className="w-full py-2 px-3 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 hover:border-emerald-500 text-emerald-300 hover:text-white font-mono text-xs font-semibold flex items-center justify-between transition cursor-pointer shadow-sm"
                title="Add p to end"
              >
                <span>&lt;p&gt;</span>
                <span className="text-[10px] text-emerald-400/80 font-sans">+ add</span>
              </button>
            </div>
          </div>
        </div>

        {currentJson.length > 0 && (
          <div className="pt-3 border-t border-zinc-800">
            <button
              onClick={handleClear}
              className="w-full py-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-medium transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </aside>

      {/* Контейнер Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-auto shadow-2xl"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          className="cursor-default relative z-10 block opacity-100"
          style={{
            position: "absolute",
            visibility: "visible",
            pointerEvents: "auto",
          }}
        />
      </div>
    </div>
  );
}
