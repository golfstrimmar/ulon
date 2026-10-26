"use client";

import React from "react";
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
// Динамический импорт модалки без SSR
const ModalNodeProperties = dynamic(
  () => import("./components/ModalNodeProperties"),
  { ssr: false },
);

export function CanvasArea() {
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

  return (
    <div className="w-full flex gap-1 h-[calc(100vh-80px)] min-h-[500px] select-none">
      {/* ЛЕВАЯ ПАНЕЛЬ: ЭЛЕМЕНТЫ И УПРАВЛЕНИЕ */}
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

      {/* РАБОЧАЯ ОБЛАСТЬ (ХОЛСТ) */}
      <div
        ref={containerRef}
        className="plaza-workspace flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
      >
        <div className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1 pb-[500px]">
          {currentJson.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-zinc-500 gap-2">
              <span className="text-3xl">🧩</span>
              <p className="text-sm font-medium">Canvas is empty</p>
            </div>
          ) : (
            <div className="w-full mx-auto flex flex-col min-h-full">
              {currentJson.map((node, index) => (
                <React.Fragment key={node._key || index}>
                  {index === 0 && (
                    <DropGap
                      targetKey={node._key || ""}
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
                    targetKey={node._key || ""}
                    position="after"
                    orientation="horizontal"
                    draggedKey={draggedKey}
                    dropTarget={dropTarget}
                  />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* ДИНАМИЧЕСКИЙ РЕДАКТОР СВОЙСТВ ВЫБРАННОЙ НОДЫ */}
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

      {/* ПРИЗРАК ПЕРЕТАСКИВАЕМОГО УЗЛА (FOLLOW CURSOR) */}
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
