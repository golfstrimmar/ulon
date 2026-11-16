"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import type { HtmlNode } from "@/types/HtmlNode";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import {
  extractDonorNodes,
  removeNodesByKeys,
  type DonorItem,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";

interface DonorTrayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isTracingActive: boolean;
  selectedBoxId: string | null;
  assignedDonorKeys: Set<string>;
  onAssignDonorToSelectedBox?: (donorKey: string) => void;
}

function MiniSvg({ node }: { node: HtmlNode }) {
  const attrs = node.attributes || {};
  return (
    <svg
      viewBox={attrs.viewBox || attrs.viewbox || "0 0 24 24"}
      className="w-full h-full text-zinc-200 pointer-events-none"
      fill={attrs.fill || "currentColor"}
      stroke={attrs.stroke || "none"}
    >
      {Array.isArray(node.children) &&
        node.children.map((c, idx) => {
          const Tag = (c.tag || "path").toLowerCase() as any;
          const { class: _c, style: _s, ...valid } = c.attributes || {};
          return <Tag key={c._key || idx} {...valid} />;
        })}
    </svg>
  );
}

export default function DonorTrayPanel({
  isOpen,
  onClose,
  isTracingActive,
  selectedBoxId,
  assignedDonorKeys,
  onAssignDonorToSelectedBox,
}: DonorTrayPanelProps) {
  const currentJson = useCanvasStore((s) => s.currentJson);
  const isSplit = useCanvasStore((s) => s.isSplit);
  const rightKeys = useCanvasStore((s) => s.rightKeys);
  const armedDonorKey = useCanvasStore((s) => s.armedDonorKey);
  const setArmedDonorKey = useCanvasStore((s) => s.setArmedDonorKey);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "text" | "media">("all");
  const [pos, setPos] = useState({ x: 0, y: 80 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    setPos({
      x: Math.max(12, window.innerWidth - 304),
      y: 84,
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && armedDonorKey) {
        setArmedDonorKey(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armedDonorKey, setArmedDonorKey]);

  const sourceNodes = useMemo(() => {
    if (isSplit && rightKeys.size > 0) {
      return removeNodesByKeys(currentJson, rightKeys);
    }
    return currentJson;
  }, [currentJson, isSplit, rightKeys]);

  const allDonors = useMemo(
    () => extractDonorNodes(sourceNodes),
    [sourceNodes],
  );

  const availableDonors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allDonors.filter((item) => {
      if (assignedDonorKeys.has(item.key)) return false;

      if (filter === "text" && !item.text) return false;
      if (filter === "media" && !item.imgSrc && !item.isSvg) return false;

      if (q) {
        const matchText = item.text.toLowerCase().includes(q);
        const matchTag = item.tag.toLowerCase().includes(q);
        const matchClass = item.className.toLowerCase().includes(q);
        return matchText || matchTag || matchClass;
      }

      return true;
    });
  }, [allDonors, assignedDonorKeys, filter, query]);

  const armedItem = useMemo(
    () => allDonors.find((d) => d.key === armedDonorKey) || null,
    [allDonors, armedDonorKey],
  );

  if (!isOpen) return null;

  const handleDonorClick = (item: DonorItem) => {
    if (isTracingActive && selectedBoxId && onAssignDonorToSelectedBox) {
      onAssignDonorToSelectedBox(item.key);
      setArmedDonorKey(null);
      return;
    }

    setArmedDonorKey(armedDonorKey === item.key ? null : item.key);
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(
        8,
        Math.min(window.innerWidth - 290, dragRef.current.origX + dx),
      ),
      y: Math.max(
        8,
        Math.min(window.innerHeight - 140, dragRef.current.origY + dy),
      ),
    });
  };

  const handleDragEnd = () => {
    dragRef.current = null;
  };

  return (
    <div
      data-wireframe-ui="true"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-72 max-h-[70vh] bg-zinc-950/95 border border-amber-500/40 rounded-xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden select-none font-mono"
    >
      {/* Drag Header */}
      <div
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        className="px-2.5 py-1.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="flex items-center gap-1.5 text-xs">
          <SparklesIcon className="size-3.5 text-amber-400" />
          <span className="font-bold text-zinc-100">Donors</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px]">
            {availableDonors.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setArmedDonorKey(null);
            onClose();
          }}
          className="p-0.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer"
          title="Close Donors tray"
        >
          <XMarkIcon className="size-4" />
        </button>
      </div>

      {/* Статус текущего режима */}
      <div className="px-2.5 py-1.5 bg-zinc-900/50 border-b border-zinc-800/80 text-[10px]">
        {armedItem ? (
          <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-amber-500/20 border border-amber-400/70 text-amber-200">
            <span className="truncate">
              ⤓ Armed:{" "}
              <strong>
                {armedItem.text || (armedItem.imgSrc ? "<img>" : "<svg>")}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setArmedDonorKey(null)}
              className="text-amber-300 hover:text-white font-bold shrink-0 cursor-pointer"
              title="Cancel (Esc)"
            >
              ✕
            </button>
          </div>
        ) : isTracingActive && selectedBoxId ? (
          <div className="text-cyan-300">
            Box selected — click donor to inject immediately
          </div>
        ) : isTracingActive ? (
          <div className="text-zinc-400">
            Click donor → then draw or click a box
          </div>
        ) : (
          <div className="text-zinc-400">
            Click donor → then click element in Preview
          </div>
        )}
      </div>

      {/* Поиск и фильтр */}
      <div className="p-2 border-b border-zinc-800/80 space-y-1.5">
        <div className="relative">
          <MagnifyingGlassIcon className="size-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text or class..."
            className="w-full pl-7 pr-6 py-1 rounded bg-zinc-900 border border-zinc-800 focus:border-amber-500/60 outline-none text-[11px] text-zinc-200 placeholder:text-zinc-600"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex gap-1 text-[10px]">
          {(["all", "text", "media"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`flex-1 py-0.5 rounded border capitalize transition cursor-pointer ${
                filter === tab
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Список доноров */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
        {availableDonors.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-zinc-600">
            No free donors found
          </div>
        ) : (
          availableDonors.map((item) => {
            const isArmed = armedDonorKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleDonorClick(item)}
                title={[`<${item.tag}>`, item.className, item.text]
                  .filter(Boolean)
                  .join(" | ")}
                className={`w-full text-left px-2 py-1.5 rounded-lg border transition flex items-center gap-2 cursor-pointer ${
                  isArmed
                    ? "bg-amber-500/25 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                    : "bg-zinc-900/80 border-zinc-800/90 hover:border-amber-500/50 hover:bg-zinc-800/80 text-zinc-200"
                }`}
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[9px] text-indigo-300 shrink-0 leading-none">
                  {item.tag}
                </span>

                {item.imgSrc && (
                  <div className="size-5 rounded border border-zinc-700 bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imgSrc}
                      alt=""
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}

                {item.isSvg && (
                  <div className="size-5 rounded border border-zinc-700 bg-zinc-950 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                    <MiniSvg node={item.node} />
                  </div>
                )}

                <span className="text-[11px] font-sans truncate flex-1">
                  {item.text ||
                    (item.imgSrc ? "Image" : item.isSvg ? "SVG icon" : "Node")}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
