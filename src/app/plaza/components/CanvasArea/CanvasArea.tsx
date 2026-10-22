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

  // Состояние раскрытых папок в боковой панели
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

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
          const updatedTree = duplicateNodeInTree(
            currentJsonRef.current,
            sourceKey
          );
          await persist(updatedTree);
        } else {
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
      {/* Боковая панель с кнопками и папками */}
      <aside className="w-56 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex flex-col justify-between shadow-xl select-none overflow-hidden">
        {/* Верхняя часть: История + элементы */}
        <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
          {/* Блок Undo / Redo */}
          <div className="space-y-1 border-b border-zinc-800 pb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
              History
            </span>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <span>↶</span> Undo
              </button>
              <button
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
                  key={tag.path}
                  onClick={() => handleAppendFromPath(tag.path)}
                  className="py-0.5 px-1 text-[11px] font-mono rounded bg-zinc-800/70 hover:bg-zinc-700 hover:text-white border border-zinc-750 text-zinc-300 truncate text-center transition cursor-pointer"
                  title={`Add <${tag.name}>`}
                >
                  &lt;{tag.name}&gt;
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Нижняя часть: Clear Canvas */}
        {currentJson.length > 0 && (
          <div className="pt-2 border-t border-zinc-800">
            <button
              onClick={handleClear}
              className="w-full py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-[11px] font-medium transition cursor-pointer"
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
