"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ROOT_TAGS,
  ELEMENT_FOLDERS,
} from "@/app/plaza/components/CanvasArea/elementsManifest";
import ButtonAddImg from "@/app/plaza/components/CanvasArea/components/ButtonAddImg";
import { useAsideCanvas } from "@/app/plaza/components/CanvasArea/components/AsideCanvas/hooks/useAsideCanvas";

export default function AsideCanvas() {
  const {
    openFolders,
    hasNodes,
    toggleFolder,
    handleClear,
    handleAppendFromPath,
    triggerUndo,
    triggerRedo,
    triggerCollapseAll,
  } = useAsideCanvas();

  return (
    <div>
      <aside className="w-48 shrink-0 bg-zinc-900 border border-zinc-800 rounded-sm p-1 flex flex-col justify-between shadow-xl select-none overflow-hidden">
        <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
          {hasNodes && (
            <div>
              <button type="button" onClick={handleClear} className="red-btn">
                Clear
              </button>
            </div>
          )}

          <div className="space-y-1 border-b border-zinc-800 pb-2">
            <div className="grid gap-1 grid-cols-[2fr_1fr_2fr]">
              <button
                type="button"
                onClick={triggerUndo}
                className="grey-btn btn"
              >
                <span>↶</span> Undo
              </button>

              <button
                type="button"
                onClick={triggerCollapseAll}
                className="grey-btn btn flex flex-col !gap-0 !p-0 opacity-100 cursor-pointer"
              >
                <i className="text-[8px]">↓</i>
                <i className="text-[8px]">↑</i>
              </button>

              <button
                type="button"
                onClick={triggerRedo}
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
                  className="admin-btn !font-bold !text-[11px]"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
