"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HtmlNode } from "@/types/HtmlNode";
import { getHtmlJson, saveHtmlJson, deleteHtmlJson } from "@/lib/htmlStorage";
import { createNode, addChildNode, updateNodeByKey, deleteNodeByKey } from "@/lib/htmlTree";
import handleRender from "./utils/handleRender";
import { RenderBox } from "./utils/types";
import { modal } from "@/lib/modal";

const DB_KEY = "plaza_tree";

export function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef<RenderBox[]>([]);

  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickedKey, setClickedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Состояние модального окна добавления / редактирования узла
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ tag: "div", text: "", class: "", style: "" });
  const [parentKeyForNew, setParentKeyForNew] = useState<string | null>(null);

  // 1. Чтение из IndexedDB при старте
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getHtmlJson(DB_KEY);
        if (data) {
          // Если сохранена одна корневая нода или массив
          setCurrentJson(Array.isArray(data) ? data : [data]);
        } else {
          // Изначально в базе пустота
          setCurrentJson([]);
        }
      } catch (err: any) {
        console.error("IndexedDB error:", err);
      } finally {
        setLoading(false);
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
      currentJson,
      hoveredKey,
      null, // draggedKey
      null, // dropTarget
      null, // dragMousePos
      collapsedKeys,
      clickedKey,
      false, // hasVisibleBg
      null, // targetParentKey
      0 // visibleMockupHeight
    );
  }, [currentJson, hoveredKey, clickedKey, collapsedKeys]);

  // Запуск отрисовки при изменении состояния
  useEffect(() => {
    render();
  }, [render]);

  // Ресайз окна
  useEffect(() => {
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [render]);

  // Сохранение изменений в IndexedDB
  const persistJson = async (updated: HtmlNode[]) => {
    setCurrentJson(updated);
    try {
      if (updated.length > 0) {
        await saveHtmlJson(DB_KEY, updated[0]);
      } else {
        await deleteHtmlJson(DB_KEY);
      }
    } catch (e: any) {
      modal.error("Save error", e.message);
    }
  };

  // Создание первого узла (если база пуста)
  const handleCreateInitial = async () => {
    const initialRoot = createNode({
      tag: "div",
      class: "container mx-auto p-4",
      children: [
        createNode({
          tag: "header",
          class: "flex justify-between items-center",
          children: [
            createNode({ tag: "h1", text: "Canvas Plaza", children: [] }),
            createNode({ tag: "button", text: "Click me", children: [] }),
          ],
        }),
        createNode({
          tag: "main",
          class: "mt-4 space-y-2",
          children: [
            createNode({ tag: "p", text: "Rendered to 2D Canvas directly from IndexedDB", children: [] }),
          ],
        }),
      ],
    });
    await persistJson([initialRoot]);
    modal.success("Created", "Initial tree saved to IndexedDB");
  };

  // Обработчик движения мыши по Canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let foundKey: string | null = null;
    // Поиск снизу вверх (самые глубокие вложенные ноды в приоритете)
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

  const handleMouseLeave = () => {
    if (hoveredKey) setHoveredKey(null);
  };

  // Клик по Canvas (сворачивание ветки или выбор ноды)
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 1. Проверяем клик по кнопке [+] / [-]
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

    // 2. Клик по самому тегу
    let clicked: string | null = null;
    for (let i = boxesRef.current.length - 1; i >= 0; i--) {
      const b = boxesRef.current[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        clicked = b.key;
        break;
      }
    }
    setClickedKey(clicked);
  };

  // Добавление потомка к выбранной ноде
  const handleAddChildToSelected = () => {
    const parent = clickedKey || (currentJson[0] ? currentJson[0]._key : null);
    if (!parent) return;
    setParentKeyForNew(parent);
    setEditForm({ tag: "div", text: "New node", class: "p-2", style: "" });
    setIsEditing(true);
  };

  // Сохранение нового узла
  const submitNewChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentKeyForNew || currentJson.length === 0) return;

    const child = createNode({
      tag: editForm.tag.trim() || "div",
      text: editForm.text,
      class: editForm.class,
      style: editForm.style,
      children: [],
    });

    const updatedRoot = addChildNode(currentJson[0], parentKeyForNew, child);
    await persistJson([updatedRoot]);
    setIsEditing(false);
    setParentKeyForNew(null);
    modal.success("Added", `<${child.tag}> added`);
  };

  // Удаление выбранного узла
  const handleDeleteSelected = async () => {
    if (!clickedKey || currentJson.length === 0) return;
    if (currentJson[0]._key === clickedKey) {
      const ok = await modal.confirm("Delete Root?", "This will empty IndexedDB.");
      if (ok) {
        await persistJson([]);
        setClickedKey(null);
      }
      return;
    }

    const updated = deleteNodeByKey(currentJson[0], clickedKey);
    if (updated) {
      await persistJson([updated]);
    } else {
      await persistJson([]);
    }
    setClickedKey(null);
    modal.info("Deleted", "Node deleted from canvas");
  };

  // Очистка базы
  const handleClear = async () => {
    const ok = await modal.confirm("Clear Canvas?", "Reset IndexedDB to empty state?");
    if (!ok) return;
    await persistJson([]);
    setClickedKey(null);
    modal.info("Cleared", "IndexedDB is empty");
  };

  const selectedBox = boxesRef.current.find((b) => b.key === clickedKey);

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Тулбар управления */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase font-mono font-bold px-2 py-1 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
            Canvas 2D
          </span>
          <span className="text-xs text-zinc-400 font-mono">
            Nodes: <span className="text-zinc-200 font-semibold">{boxesRef.current.length}</span>
          </span>
          {selectedBox && (
            <span className="text-xs text-indigo-300 font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/50">
              Selected: &lt;{selectedBox.tag}&gt;
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentJson.length === 0 ? (
            <button
              onClick={handleCreateInitial}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer"
            >
              + Create Initial Tree
            </button>
          ) : (
            <>
              <button
                onClick={handleAddChildToSelected}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer"
              >
                + Add Child
              </button>
              {clickedKey && (
                <button
                  onClick={handleDeleteSelected}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/80 text-red-400 border border-zinc-700 hover:border-red-800 text-xs font-medium transition cursor-pointer"
                >
                  Delete Selected
                </button>
              )}
              <button
                onClick={handleClear}
                className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-medium transition cursor-pointer"
              >
                Clear DB
              </button>
            </>
          )}
        </div>
      </div>

      {/* Контейнер Canvas */}
      <div
        ref={containerRef}
        className="w-full relative min-h-[500px] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-auto shadow-2xl p-2"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 font-mono text-sm">
            Loading IndexedDB...
          </div>
        )}

        {!loading && currentJson.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl text-zinc-500 font-mono">
              ∅
            </div>
            <div className="text-zinc-400 text-sm">
              IndexedDB is currently empty.
            </div>
            <button
              onClick={handleCreateInitial}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer shadow"
            >
              + Create Initial Tree
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className="cursor-default relative z-10 block opacity-100"
          style={{
            position: "relative",
            visibility: "visible",
            pointerEvents: "auto",
          }}
        />
      </div>

      {/* Модальное окно создания дочерней ноды */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Add Child Node
            </h3>
            <p className="text-xs text-zinc-400 mb-4 font-mono">
              Adding to parent: {parentKeyForNew}
            </p>

            <form onSubmit={submitNewChild} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Tag
                </label>
                <input
                  type="text"
                  required
                  value={editForm.tag}
                  onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
                  placeholder="div, header, h1, button, p..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Text Content (Optional)
                </label>
                <input
                  type="text"
                  value={editForm.text}
                  onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                  placeholder="Text label..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow cursor-pointer"
                >
                  Add Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
