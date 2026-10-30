"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/outline";
import { useCanvasArea } from "@/app/plaza/components/CanvasArea/hooks/useCanvasArea";
import { NodeCard } from "@/app/plaza/components/CanvasArea/components/NodeCard";
import { DropGap } from "@/app/plaza/components/CanvasArea/components/DropGap";
import {
  findNodeInTree,
  getNodeKey,
  collectAllDescendantKeys,
  removeNodesByKeys,
  extractNodesByKeys,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";

import type { HtmlNode } from "@/types/HtmlNode";
import AsideCanvas from "@/app/plaza/components/CanvasArea/components/AsideCanvas/AsideCanvas";

const ModalNodeProperties = dynamic(
  () => import("./components/ModalNodeProperties"),
  { ssr: false },
);

//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export function CanvasArea() {
  const [isSplit, setIsSplit] = useState(false);
  // Ключи нод, перенесенных в правую колонку
  const [rightKeys, setRightKeys] = useState<Set<string>>(new Set());

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const {
    containerRef,
    currentJson,
    collapsedKeys,
    hoveredKey,
    clickedKey,
    selectedNode,
    draggedKey,
    dropTarget,
    dragMousePos,
    draggedNode,
    globalScss,
    globalJs,
    editTag,
    editClass,
    editText,
    setEditTag,
    setEditClass,
    setEditText,
    setHoveredKey,
    setClickedKey,
    handlePointerDownNode,
    handleToggleCollapse,
    handleClickNode,
    handleDoubleClickNode,
    handleSaveNodeField,
    handleSaveScriptJs,
    handleAddClassToNode,
    updateAndPersistScss,
  } = useCanvasArea();

  const draggedNodeRef = useRef(draggedNode);
  const draggedKeyRef = useRef(draggedKey);
  draggedNodeRef.current = draggedNode;
  draggedKeyRef.current = draggedKey;

  // Разделение нод: левая колонка получает только свои, правая — только свои
  const leftNodes = useMemo(() => {
    if (!isSplit || rightKeys.size === 0) return currentJson;
    return removeNodesByKeys(currentJson, rightKeys);
  }, [currentJson, rightKeys, isSplit]);

  const rightNodes = useMemo(() => {
    if (!isSplit || rightKeys.size === 0) return [];
    return extractNodesByKeys(currentJson, rightKeys);
  }, [currentJson, rightKeys, isSplit]);

  // Отслеживаем перетаскивание между левой и правой колонками
  useEffect(() => {
    if (!isSplit) return;

    const handlePointerUp = (e: PointerEvent) => {
      const activeKey =
        draggedKeyRef.current || getNodeKey(draggedNodeRef.current);
      if (!activeKey) return;

      const leftEl = leftPaneRef.current;
      const rightEl = rightPaneRef.current;

      const isInside = (el: HTMLElement | null) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return (
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        );
      };

      const overRight = isInside(rightEl);
      const overLeft = isInside(leftEl);

      const targetSubtree =
        draggedNodeRef.current || findNodeInTree(currentJson, activeKey);
      const allSubtreeKeys = targetSubtree
        ? collectAllDescendantKeys(targetSubtree)
        : [activeKey];

      if (overRight) {
        setRightKeys((prev) => {
          const next = new Set(prev);
          for (const k of allSubtreeKeys) {
            next.add(k);
          }
          return next;
        });
      } else if (overLeft) {
        setRightKeys((prev) => {
          const next = new Set(prev);
          for (const k of allSubtreeKeys) {
            next.delete(k);
          }
          return next;
        });
      }
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [isSplit, currentJson]);

  const toggleSplitMode = () => {
    if (isSplit) {
      setRightKeys(new Set());
      setIsSplit(false);
    } else {
      setIsSplit(true);
    }
  };

  /** Рендер списка нод со всеми DropGap */
  const renderNodeList = (nodes: HtmlNode[], panePrefix: string) => {
    return (
      <div className="w-full mx-auto flex flex-col min-h-full">
        {nodes.map((node, index) => (
          <React.Fragment key={`${panePrefix}-${getNodeKey(node) || index}`}>
            {index === 0 && (
              <DropGap
                targetKey={getNodeKey(node)}
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
              targetKey={getNodeKey(node)}
              position="after"
              orientation="horizontal"
              draggedKey={draggedKey}
              dropTarget={dropTarget}
            />
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full flex gap-1   select-none">
      {/* ЛЕВАЯ ПАНЕЛЬ С КНОПКАМИ */}
      <AsideCanvas />

      {/* РАБОЧАЯ ОБЛАСТЬ ХОЛСТА */}
      <div
        ref={containerRef}
        className="plaza-workspace flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* ВЕРХНИЙ БАР */}
        <div className="h-7 shrink-0 bg-zinc-900 border-b border-zinc-800 pl-2 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono !text-[10px]">Workspace</span>
          <button
            type="button"
            onClick={toggleSplitMode}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors pointer-pointer hover:bg-zinc-700 ${
              isSplit ? " text-white" : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {isSplit ? (
              <ArrowRightCircleIcon className="size-4" />
            ) : (
              <ArrowLeftCircleIcon className="size-4" />
            )}
          </button>
        </div>

        {/* СПЛИТ-ОБЛАСТЬ (PANE 1 И PANE 2) */}
        <div className="flex-1 flex overflow-hidden">
          {/* ЛЕВАЯ КОЛОНКА (PANE 1) */}
          <div
            ref={leftPaneRef}
            className="flex-1 h-full overflow-hidden flex flex-col"
          >
            {isSplit && (
              <div className="px-3 py-1 bg-zinc-900/40 text-[11px] font-mono text-zinc-500 border-b border-zinc-800/40 flex justify-between">
                <span>Pane 1</span>
                <span>{leftNodes.length} items</span>
              </div>
            )}
            <div className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1 ">
              {leftNodes.length === 0 ? (
                <div className="h-full  flex items-center justify-center text-zinc-600 text-xs font-mono">
                  Empty
                </div>
              ) : (
                renderNodeList(leftNodes, "p1")
              )}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА (PANE 2) */}
          {isSplit && (
            <div
              ref={rightPaneRef}
              className={`flex-1 h-full overflow-hidden flex flex-col border-l border-zinc-800 transition-colors ${
                draggedNode ? "bg-zinc-900/30" : "bg-zinc-950"
              }`}
            >
              <div className="px-3 py-1 bg-zinc-900/40 text-[11px] font-mono text-zinc-500 border-b border-zinc-800/40 flex justify-between">
                <span>Pane 2</span>
                <span>{rightNodes.length} items</span>
              </div>

              <div className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1 ">
                {rightNodes.length === 0 ? (
                  <div
                    className={`w-full h-full  border border-dashed rounded flex items-center justify-center text-xs font-mono transition-colors ${
                      draggedNode
                        ? "border-zinc-500 text-zinc-300 bg-zinc-900/50"
                        : "border-zinc-800/50 text-zinc-700"
                    }`}
                  >
                    Drop nodes here
                  </div>
                ) : (
                  renderNodeList(rightNodes, "p2")
                )}
              </div>
            </div>
          )}
        </div>

        {/* МОДАЛКА СВОЙСТВ */}
        <ModalNodeProperties
          clickedKey={clickedKey}
          selectedNode={selectedNode}
          editTag={editTag}
          editClass={editClass}
          editText={editText}
          globalScss={globalScss}
          globalJs={globalJs}
          setEditTag={setEditTag}
          setEditClass={setEditClass}
          setEditText={setEditText}
          onClose={() => setClickedKey(null)}
          onSaveNodeField={handleSaveNodeField}
          onSaveScriptJs={handleSaveScriptJs}
          onAddClassToNode={handleAddClassToNode}
          updateAndPersistScss={updateAndPersistScss}
        />
      </div>

      {/* ПРИЗРАК DRAG */}
      {draggedNode && dragMousePos && (
        <div
          style={{
            position: "fixed",
            left: dragMousePos.x + 14,
            top: dragMousePos.y + 14,
            pointerEvents: "none",
            zIndex: 99999,
          }}
          className="px-2.5 py-1 rounded-md bg-indigo-950/90 border border-indigo-400 text-white shadow-2xl flex items-center gap-2 backdrop-blur-sm select-none"
        >
          <span className="px-1.5 py-0.5 rounded text-[11px] font-mono uppercase bg-indigo-900 border border-indigo-500 text-indigo-200 leading-none">
            {draggedNode.tag || "div"}
          </span>

          {draggedNode.class && (
            <span className="text-[11px] font-mono text-green-300 max-w-[140px] truncate leading-none">
              .{draggedNode.class.trim().replace(/\s+/g, " .")}
            </span>
          )}

          {draggedNode.text && (
            <span className="text-[11px] text-zinc-300 max-w-[100px] truncate leading-none font-sans">
              &quot;{draggedNode.text}&quot;
            </span>
          )}
        </div>
      )}
    </div>
  );
}
