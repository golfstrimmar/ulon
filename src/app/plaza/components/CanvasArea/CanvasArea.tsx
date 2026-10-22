"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { getHtmlJson } from "@/lib/htmlStorage";
import handleRender from "./utils/handleRender";
import type { RenderBox } from "./utils/types";

const DB_KEY = "plaza_tree";

export function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef<RenderBox[]>([]);

  // В базе изначально пустота: currentJson = []
  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickedKey, setClickedKey] = useState<string | null>(null);

  // Чтение дерева из базы IndexedDB (если базы нет или пусто — остается пустой массив [])
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

  // Механизм рендеринга на canvas
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

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-120px)] bg-zinc-950 border border-zinc-800 rounded-xl overflow-auto"
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
  );
}
