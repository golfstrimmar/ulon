"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ROOT_TAGS,
  ELEMENT_FOLDERS,
} from "@/app/plaza/components/CanvasArea/elementsManifest";
import { useCanvasArea } from "@/app/plaza/components/CanvasArea/hooks/useCanvasArea";
import { NodeCard } from "@/app/plaza/components/CanvasArea/components/NodeCard";
import { DropGap } from "@/app/plaza/components/CanvasArea/components/DropGap";
import ButtonAddImg from "@/app/plaza/components/CanvasArea/components/ButtonAddImg";
import type { HtmlNode } from "@/types/HtmlNode";

const ModalNodeProperties = dynamic(
  () => import("./components/ModalNodeProperties"),
  { ssr: false },
);

const getNodeKey = (node: any): string => node?._key || node?.id || "";

/** Удаляет указанные ключи из дерева */
function removeNodesByKeys(nodes: any[], keys: Set<string>): any[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n) => !keys.has(getNodeKey(n)))
    .map((n) => {
      if (Array.isArray(n.children)) {
        return {
          ...n,
          children: removeNodesByKeys(n.children, keys),
        };
      }
      return n;
    });
}

/** Извлекает ноды с указанными ключами */
function extractNodesByKeys(nodes: any[], keys: Set<string>): any[] {
  if (!Array.isArray(nodes)) return [];
  const found: any[] = [];
  function walk(list: any[]) {
    for (const item of list) {
      if (keys.has(getNodeKey(item))) {
        found.push(item);
      } else if (Array.isArray(item.children)) {
        walk(item.children);
      }
    }
  }
  walk(nodes);
  return found;
}

export function CanvasArea() {
  const [isSplit, setIsSplit] = useState(false);
  // Ключи нод, перенесенных в правую колонку
  const [rightKeys, setRightKeys] = useState<Set<string>>(new Set());

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const {
    containerRef,
    currentJson,
    canUndo,
    canRedo,
    openFolders,
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
    handleUndo,
    handleRedo,
    handleClear,
    toggleFolder,
    handleAppendFromPath,
    handlePointerDownNode,
    handleToggleCollapse,
    handleClickNode,
    handleDoubleClickNode,
    handleSaveNodeField,
    handleSaveScriptJs,
    handleAddClassToNode,
    updateAndPersistScss,
    isCollapsible,
    collapsedAll,
    isAllCollapsed,
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

      // Бросили в правую колонку -> переходит вправо
      if (overRight) {
        setRightKeys((prev) => {
          if (prev.has(activeKey)) return prev;
          const next = new Set(prev);
          next.add(activeKey);
          return next;
        });
      }
      // Бросили в левую колонку -> возвращается влево
      else if (overLeft) {
        setRightKeys((prev) => {
          if (!prev.has(activeKey)) return prev;
          const next = new Set(prev);
          next.delete(activeKey);
          return next;
        });
      }
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [isSplit]);

  const toggleSplitMode = () => {
    if (isSplit) {
      // При закрытии сплита все ноды объединяются обратно
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
    <div className="w-full flex gap-1 h-[calc(100vh-80px)] min-h-[500px] select-none">
      {/* ЛЕВАЯ ПАНЕЛЬ С КНОПКАМИ */}
      <aside className="w-48 shrink-0 bg-zinc-900 border border-zinc-800 rounded-sm p-1 flex flex-col justify-between shadow-xl select-none overflow-hidden">
        <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
          {currentJson.length > 0 && (
            <div>
              <button type="button" onClick={handleClear} className="red-btn">
                Clear
              </button>
            </div>
          )}

          <div className="space-y-1 border-b border-zinc-800 pb-2">
            <div
              className={`grid gap-1 ${isCollapsible ? "grid-cols-[2fr_1fr_2fr]" : "grid-cols-[2fr_2fr]"}`}
            >
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="grey-btn btn"
              >
                <span>↶</span> Undo
              </button>
              {isCollapsible && (
                <button
                  onClick={() => collapsedAll()}
                  className={`grey-btn btn flex flex-col !gap-0 !p-0 ${
                    isAllCollapsed
                      ? "opacity-40 cursor-not-allowed"
                      : "opacity-100 cursor-pointer"
                  }`}
                  disabled={isAllCollapsed}
                >
                  <i className="text-[8px] ">↓</i>
                  <i className="text-[8px] ">↑</i>
                </button>
              )}

              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className="grey-btn btn"
              >
                <span>↷</span> Redo
              </button>
            </div>
          </div>

          <ButtonAddImg />
          <div className="space-y-1">
            {ELEMENT_FOLDERS.map((folder) => {
              const isOpen = openFolders.has(folder.name);
              return (
                <div key={folder.name} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.name)}
                    className="admin-btn !justify-between"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{isOpen ? "📂" : "📁"}</span>
                      <span className="font-mono">{folder.name}</span>
                    </span>
                    <span className="text-[12px] text-zinc-500 font-mono">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, y: 0 }}
                        animate={{ height: "auto", opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="pl-3 py-0.5 space-y-1 border-l border-zinc-800/80"
                      >
                        <div className="flex flex-col gap-1">
                          {folder.items.map((item) => (
                            <button
                              type="button"
                              key={item.path}
                              onClick={() => handleAppendFromPath(item.path)}
                              className="admin-btn"
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="space-y-1 pt-1.5 border-t border-zinc-800">
            <div className="grid grid-cols-2 gap-1">
              {ROOT_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag.path}
                  onClick={() => handleAppendFromPath(tag.path)}
                  className="admin-btn"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* РАБОЧАЯ ОБЛАСТЬ ХОЛСТА */}
      <div
        ref={containerRef}
        className="plaza-workspace flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* ВЕРХНИЙ БАР */}
        <div className="h-7 shrink-0 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono text-[11px]">Workspace</span>
          <button
            type="button"
            onClick={toggleSplitMode}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
              isSplit
                ? "bg-zinc-700 text-white"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            }`}
          >
            {isSplit ? "Close Split" : "Split"}
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
            <div className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1 pb-[500px]">
              {leftNodes.length === 0 ? (
                <div className="h-full min-h-[300px] flex items-center justify-center text-zinc-600 text-xs font-mono">
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

              <div className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1 pb-[500px]">
                {rightNodes.length === 0 ? (
                  <div
                    className={`w-full h-full min-h-[250px] border border-dashed rounded flex items-center justify-center text-xs font-mono transition-colors ${
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
