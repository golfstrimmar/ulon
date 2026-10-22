"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { getHtmlJson, saveHtmlJson, deleteHtmlJson } from "@/lib/htmlStorage";
import { generateNodeKey } from "@/lib/htmlTree";
import handleRender from "./utils/handleRender";
import type { RenderBox } from "./utils/types";

const DB_KEY = "plaza_tree";

/**
 * Рекурсивное присвоение уникальных _key для загружаемого фрагмента
 */
function assignKeysToFragment(node: HtmlNode): HtmlNode {
  return {
    ...node,
    _key: generateNodeKey(),
    children: Array.isArray(node.children)
      ? node.children.map(assignKeysToFragment)
      : node.children || [],
  };
}

/**
 * Добавление фрагментов в конец дерева или в конец выбранного узла
 */
function appendFragment(
  tree: HtmlNode[],
  targetKey: string | null,
  newNodes: HtmlNode[]
): HtmlNode[] {
  if (!targetKey || tree.length === 0) {
    return [...tree, ...newNodes];
  }

  function insert(nodes: HtmlNode[]): HtmlNode[] {
    return nodes.map((n) => {
      if (n._key === targetKey) {
        const existing = Array.isArray(n.children) ? n.children : [];
        return {
          ...n,
          children: [...existing, ...newNodes],
        };
      }
      if (Array.isArray(n.children)) {
        return {
          ...n,
          children: insert(n.children),
        };
      }
      return n;
    });
  }

  return insert(tree);
}

export function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef<RenderBox[]>([]);

  // В базе изначально пустота: currentJson = []
  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickedKey, setClickedKey] = useState<string | null>(null);

  // 1. Чтение из базы IndexedDB (изначально пустота)
  useEffect(() => {
    (async () => {
      try {
        const data = await getHtmlJson(DB_KEY);
        if (data) {
          setCurrentJson(Array.isArray(data) ? data : [data]);
        } else {
          setCurrentJson([]);
        }
      } catch (err) {
        console.error("IndexedDB read error:", err);
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
      currentJson,
      hoveredKey,
      null,
      null,
      null,
      collapsedKeys,
      clickedKey,
      false,
      null,
      0
    );
  }, [currentJson, hoveredKey, clickedKey, collapsedKeys]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [render]);

  // Сохранение в IndexedDB
  const persist = async (next: HtmlNode[]) => {
    setCurrentJson(next);
    try {
      if (next.length > 0) {
        await saveHtmlJson(DB_KEY, next[0]);
      } else {
        await deleteHtmlJson(DB_KEY);
      }
    } catch (e) {
      console.error("Failed to save to IndexedDB:", e);
    }
  };

  // Загрузка фрагмента из public/json/[tag].json и наращивание в конец
  const handleAppendFromPublic = async (tag: "div" | "p") => {
    try {
      const res = await fetch(`/json/${tag}.json`);
      if (!res.ok) {
        console.error(`Failed to load /json/${tag}.json`);
        return;
      }
      const raw = await res.json();
      const nodes: HtmlNode[] = Array.isArray(raw) ? raw : [raw];
      const withKeys = nodes.map(assignKeysToFragment);

      const next = appendFragment(currentJson, clickedKey, withKeys);
      await persist(next);

      // Если добавляли в пустую базу — делаем добавленный узел активным
      if (currentJson.length === 0 && withKeys[0]?._key) {
        setClickedKey(withKeys[0]._key);
      }
    } catch (e) {
      console.error(`Error appending ${tag}:`, e);
    }
  };

  // Очистка канваса и базы
  const handleClear = async () => {
    await persist([]);
    setClickedKey(null);
    setHoveredKey(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

  const handleMouseLeave = () => {
    if (hoveredKey) setHoveredKey(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

    // Выбор ноды
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

  const selectedBox = boxesRef.current.find((b) => b.key === clickedKey);

  return (
    <div className="w-full flex gap-4 h-[calc(100vh-120px)] min-h-[500px]">
      {/* Боковая панель с кнопками */}
      <aside className="w-44 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between shadow-xl">
        <div className="space-y-4">
          <div className="border-b border-zinc-800 pb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
              Insert Nodes
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              from /public/json
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleAppendFromPublic("div")}
              className="w-full py-2 px-3 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 hover:border-indigo-500 text-indigo-300 hover:text-white font-mono text-xs font-semibold flex items-center justify-between transition cursor-pointer shadow-sm"
              title="Append div fragment"
            >
              <span>&lt;div&gt;</span>
              <span className="text-[10px] text-indigo-400/80 font-sans">+ add</span>
            </button>

            <button
              onClick={() => handleAppendFromPublic("p")}
              className="w-full py-2 px-3 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 hover:border-emerald-500 text-emerald-300 hover:text-white font-mono text-xs font-semibold flex items-center justify-between transition cursor-pointer shadow-sm"
              title="Append p fragment"
            >
              <span>&lt;p&gt;</span>
              <span className="text-[10px] text-emerald-400/80 font-sans">+ add</span>
            </button>
          </div>

          {/* Индикатор текущей цели вставки */}
          <div className="pt-2 border-t border-zinc-800/80 text-[11px]">
            <div className="text-zinc-500 text-[10px] uppercase font-mono mb-1">
              Append Target:
            </div>
            {selectedBox ? (
              <div className="space-y-1">
                <span className="font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/60 block truncate">
                  &lt;{selectedBox.tag}&gt;
                </span>
                <button
                  onClick={() => setClickedKey(null)}
                  className="text-[10px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                >
                  Deselect (add to root)
                </button>
              </div>
            ) : (
              <span className="text-zinc-400 font-mono">Root end</span>
            )}
          </div>
        </div>

        {currentJson.length > 0 && (
          <div className="pt-3 border-t border-zinc-800">
            <button
              onClick={handleClear}
              className="w-full py-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-medium transition cursor-pointer"
            >
              Clear Canvas
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
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
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
