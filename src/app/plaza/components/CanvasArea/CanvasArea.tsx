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

  // Изначально в базе пустота
  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickedKey, setClickedKey] = useState<string | null>(null);

  // Чтение из IndexedDB при старте (если пусто — пустой массив [])
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
        console.error("IndexedDB error:", err);
        setCurrentJson([]);
      }
    })();
  }, []);

  // Отрисовка на canvas
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
        await saveHtmlJson(DB_KEY, next);
      } else {
        await deleteHtmlJson(DB_KEY);
      }
    } catch (e) {
      console.error("Failed to save to IndexedDB:", e);
    }
  };

  // Добавление узла из /public/json/[tag].json в конец (одна под другой, без вложения)
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

      // Добавляем строго в конец списка (одна под другой)
      const next = [...currentJson, ...withKeys];
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

  return (
    <div className="w-full flex gap-4 h-[calc(100vh-120px)] min-h-[500px]">
      {/* Боковая панель с кнопками */}
      <aside className="w-40 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between shadow-xl">
        <div className="space-y-3">
          <div className="border-b border-zinc-800 pb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
              Elements
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              /public/json
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
