"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HtmlNode } from "@/types/HtmlNode";
import { COMMON_TAGS } from "../lib/canvasModel";
import { MonacoPropertiesEditor } from "@/app/plaza/components/MonacoPropertiesEditor/MonacoPropertiesEditor";

interface ModalNodePropertiesProps {
  clickedKey: string | null;
  selectedNode: HtmlNode | null;
  editTag: string;
  editClass: string;
  editText: string;
  globalScss: string;
  globalJs: string;
  setEditTag: (tag: string) => void;
  setEditClass: (cls: string) => void;
  setEditText: (txt: string) => void;
  onClose: () => void;
  onSaveNodeField: (
    field: "tag" | "class" | "text" | "attributes",
    value: any,
  ) => Promise<void>;
  onSaveScriptJs: (targetName: string, jsCode: string) => Promise<void>;
  onAddClassToNode: (newCls: string) => Promise<void>;
  updateAndPersistScss: (nextScss: string) => Promise<void>;
}

export default function ModalNodeProperties({
  clickedKey,
  selectedNode,
  editTag,
  editClass,
  editText,
  globalScss,
  globalJs,
  setEditTag,
  setEditClass,
  setEditText,
  onClose,
  onSaveNodeField,
  onSaveScriptJs,
  onAddClassToNode,
  updateAndPersistScss,
}: ModalNodePropertiesProps) {
  return (
    <AnimatePresence>
      {clickedKey && selectedNode && (
        <motion.div
          initial={{ height: 0, opacity: 0, y: 0 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: 0 }}
          transition={{ duration: 0.1, ease: "easeInOut" }}
          className="fixed shadow-[0_-6px_18px_rgba(32,75,110,0.7)] bottom-0 right-0 w-[calc(100vw-210px)] z-40"
        >
          <div className="relative bg-zinc-800 border-t border-zinc-700 rounded-t-sm shadow-[0_-8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-1 left-2 z-50 w-10 h-4.5 rounded-lg bg-red-600 hover:bg-red-500 border-2 border-red-400 text-white text-sm font-bold flex items-center justify-center shadow transition-all cursor-pointer"
            >
              ✕
            </button>

            <div className="p-1 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] pl-15 font-mono text-zinc-500 uppercase tracking-widest">
                  Editing
                </span>
                <span className="text-[11px] font-mono text-emerald-300 truncate max-w-[200px]">
                  &lt;{selectedNode.tag || "div"}&gt;
                  {selectedNode.class
                    ? ` .${selectedNode.class.split(" ")[0]}`
                    : ""}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <label className="text-[10px] tracking-widest text-zinc-400 block">
                  Tag
                </label>
                <div className="flex flex-wrap gap-1">
                  {COMMON_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={async () => {
                        setEditTag(t);
                        await onSaveNodeField("tag", t);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                        editTag === t
                          ? "bg-indigo-600 border-indigo-400 text-white shadow"
                          : "bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-indigo-500 hover:text-indigo-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_2fr] gap-2 items-start mt-2">
                <div>
                  <label className="text-[10px] tracking-widest text-zinc-400 block">
                    Classes
                  </label>
                  <input
                    type="text"
                    value={editClass}
                    onChange={(e) => setEditClass(e.target.value)}
                    onBlur={async (e) => {
                      await onSaveNodeField("class", e.target.value);
                    }}
                    placeholder="flex items-center gap-2..."
                    className="w-full px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-600 text-green-300 text-[14px] placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 block">
                    Text
                  </label>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={async (e) => {
                      await onSaveNodeField("text", e.target.value);
                    }}
                    rows={3}
                    placeholder="Text content..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-100 text-[12px] font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition resize-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800">
                {(() => {
                  const classSource =
                    editClass !== undefined && editClass !== null
                      ? editClass
                      : selectedNode.class || "";
                  const nodeClasses = classSource
                    .split(/\s+/)
                    .map((c) => c.trim().replace(/^\./, ""))
                    .filter(Boolean);

                  return (
                    <MonacoPropertiesEditor
                      nodeKey={selectedNode._key || ""}
                      nodeTag={selectedNode.tag || "div"}
                      nodeClasses={nodeClasses}
                      globalScss={globalScss}
                      globalJs={globalJs}
                      attributesValue={selectedNode.attributes}
                      onSaveGlobalScss={updateAndPersistScss}
                      onSaveScriptJs={onSaveScriptJs}
                      onSaveAttributes={async (newAttrs) => {
                        await onSaveNodeField("attributes", newAttrs);
                      }}
                      onAddClassToNode={onAddClassToNode}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
