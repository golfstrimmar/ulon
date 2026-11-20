"use client";

import React from "react";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
  SparklesIcon,
  TagIcon,
  Square3Stack3DIcon,
  CloudArrowUpIcon,
} from "@heroicons/react/24/outline";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

interface CanvasToolbarProps {
  graphZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onOpenProjects: () => void;
  onDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function CanvasToolbar({
  graphZoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenProjects,
  onDragStart,
  onDragMove,
  onDragEnd,
}: CanvasToolbarProps) {
  const isCanvasFloating = useCanvasStore((s) => s.isCanvasFloating);
  const toggleCanvasFloating = useCanvasStore((s) => s.toggleCanvasFloating);
  const applyBemClasses = useCanvasStore((s) => s.applyBemClasses);
  const isTemplateMode = useCanvasStore((s) => s.isTemplateMode);
  const toggleTemplateMode = useCanvasStore((s) => s.toggleTemplateMode);
  const templateSlotKeys = useCanvasStore((s) => s.templateSlotKeys);
  const isDonorMode = useCanvasStore((s) => s.isDonorMode);
  const toggleDonorMode = useCanvasStore((s) => s.toggleDonorMode);
  const isSplit = useCanvasStore((s) => s.isSplit);
  const toggleSplitMode = useCanvasStore((s) => s.toggleSplitMode);

  return (
    <div
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      className={`h-7 shrink-0 bg-zinc-900 border-b border-zinc-800 pl-2 pr-1 flex items-center justify-between text-xs text-zinc-400 ${
        isCanvasFloating ? "cursor-grab active:cursor-grabbing touch-none" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono !text-[10px]">
          {isCanvasFloating ? "⋮⋮ Workspace" : "Workspace"}
        </span>

        <button
          type="button"
          onClick={toggleCanvasFloating}
          title={
            isCanvasFloating
              ? "Return Canvas back to bottom"
              : "Float Canvas on top over Preview"
          }
          className={`p-0.5 rounded transition-colors cursor-pointer hover:bg-zinc-700 ${
            isCanvasFloating
              ? "text-indigo-300 bg-indigo-500/20"
              : "text-zinc-300"
          }`}
        >
          {isCanvasFloating ? (
            <ArrowDownCircleIcon className="size-4" />
          ) : (
            <ArrowUpCircleIcon className="size-4" />
          )}
        </button>

        {/* MINI ZOOM */}
        <div
          title="Graph zoom (also Ctrl + Mouse Wheel)"
          className="flex items-center bg-zinc-800 rounded border border-zinc-700/50 text-[10px] font-mono overflow-hidden"
        >
          <button
            type="button"
            onClick={onZoomOut}
            className="px-1.5 py-0.5 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
          >
            −
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            title="Reset zoom to 100%"
            className="px-1 py-0.5 hover:bg-zinc-700 text-zinc-200 cursor-pointer min-w-[34px] text-center"
          >
            {Math.round(graphZoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="px-1.5 py-0.5 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenProjects}
          title="Manage user projects and website folders in Neon DB"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer border bg-blue-950/40 text-blue-300 hover:text-white hover:bg-blue-600/30 border-blue-700/50"
        >
          <CloudArrowUpIcon className="size-3.5 text-blue-400" />
          <span>Projects</span>
        </button>

        <button
          type="button"
          onClick={applyBemClasses}
          title="Auto-generate BEM classes for selected parent"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer border bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border-zinc-700/50 hover:border-indigo-500/50"
        >
          <TagIcon className="size-3.5 text-indigo-400" />
          <span>+ class</span>
        </button>

        {/* TEMPLATE MODE BUTTON */}
        <button
          type="button"
          onClick={toggleTemplateMode}
          title={
            isTemplateMode
              ? "Template mode: ON (click right nodes to set slots [1], [2]..., then click left nodes in any order to fill)"
              : "Template mode: OFF"
          }
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer border ${
            isTemplateMode
              ? "bg-indigo-600/25 text-indigo-200 border-indigo-500/70 shadow-[0_0_12px_rgba(99,102,241,0.35)]"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border-zinc-700/50"
          }`}
        >
          <Square3Stack3DIcon
            className={`size-3.5 ${
              isTemplateMode ? "text-indigo-400" : "text-zinc-400"
            }`}
          />
          <span>Template</span>
          {templateSlotKeys.length > 0 && (
            <span className="px-1 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
              {templateSlotKeys.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleDonorMode}
          title={
            isDonorMode
              ? "Donor mode: ON (dropping onto Pane 2 node merges props and removes donor)"
              : "Donor mode: OFF (nodes are nested normally)"
          }
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer border ${
            isDonorMode
              ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border-zinc-700/50"
          }`}
        >
          <SparklesIcon
            className={`size-3.5 ${
              isDonorMode ? "text-amber-400" : "text-zinc-400"
            }`}
          />
          <span>Donor</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isDonorMode ? "bg-amber-400 animate-pulse" : "bg-zinc-600"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={toggleSplitMode}
          title={isSplit ? "Collapse split panel" : "Expand split panel"}
          className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer hover:bg-zinc-700 ${
            isSplit ? "text-white" : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {isSplit ? (
            <ArrowRightCircleIcon className="size-4" />
          ) : (
            <ArrowLeftCircleIcon className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
