"use client";

import React from "react";
import dynamic from "next/dynamic";
import ModalCustomStyles from "@/app/plaza/components/CanvasArea/components/ModalCustomStyles/ModalCustomStyles";
import ButtonUndoRedoScss from "@/components/ButtonUndoRedoScss";
import { useMonacoPropertiesEditor } from "./useMonacoPropertiesEditor";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[160px] w-full flex items-center justify-center bg-zinc-950 text-xs font-mono text-zinc-500">
      <span className="animate-pulse">Loading editor...</span>
    </div>
  ),
});

export interface MonacoPropertiesEditorProps {
  nodeKey?: string;
  nodeTag?: string;
  nodeClasses: string[];
  nodeStyle?: string;
  globalScss: string;
  globalJs?: string;
  attributesValue?: Record<string, string>;
  onSaveGlobalScss: (nextScss: string) => Promise<void> | void;
  onSaveScriptJs?: (targetName: string, jsCode: string) => Promise<void>;
  onAddClassToNode?: (newCls: string) => Promise<void>;
  onSaveAttributes?: (
    attributes: Record<string, string>,
  ) => Promise<void> | void;
}

export function MonacoPropertiesEditor(props: MonacoPropertiesEditorProps) {
  const { nodeClasses, globalScss } = props;

  const {
    openTarget,
    activeScope,
    setActiveScope,
    currentText,
    attrsCount,
    handleToggleClass,
    handleToggleAttributes,
    handleDeleteCurrentClassCss,
    handleApplySnippet,
    handleTextChange,
    handleEditorDidMount,
  } = useMonacoPropertiesEditor(props);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Classes & Attributes Header Bar */}
      <div className="flex flex-wrap justify-between items-center gap-1.5 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono tracking-wider text-zinc-400 font-semibold mr-1 shrink-0">
            Classes:
          </span>

          {nodeClasses.length > 0 ? (
            nodeClasses.map((cls) => {
              const isOpen = openTarget === cls;
              const hasSnippet = globalScss.includes(`.${cls}`);

              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => handleToggleClass(cls)}
                  title={`Edit SCSS for .${cls}`}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 ${
                    isOpen
                      ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow"
                      : hasSnippet
                        ? "bg-zinc-900 border-zinc-700 text-emerald-400 hover:bg-zinc-800"
                        : "bg-zinc-900 border-zinc-750 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <span>.{cls}</span>
                  {hasSnippet && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })
          ) : (
            <span className="text-[11px] font-mono text-zinc-500 italic">
              No classes
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleAttributes}
          className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 font-bold shrink-0 ml-1 ${
            openTarget === "__attributes__"
              ? "bg-indigo-600 border-indigo-400 text-white shadow"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <span>⚙️ Attributes</span>
          {attrsCount > 0 && (
            <span className="px-1 py-0.1 bg-indigo-950 border border-indigo-700/80 text-indigo-300 rounded-full text-[9px]">
              {attrsCount}
            </span>
          )}
        </button>
      </div>

      {/* Editor Body */}
      {openTarget && (
        <div className="w-full flex flex-col rounded-lg border border-indigo-500/60 bg-zinc-950 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-950/70 border-b border-indigo-900/60 select-none">
            <ModalCustomStyles
              currentClass={openTarget}
              currentScssText={currentText}
              activeScope={activeScope}
              onScopeChange={setActiveScope}
              onApplySnippet={handleApplySnippet}
            />

            <ButtonUndoRedoScss />

            <div className="flex items-center gap-2">
              {openTarget !== "__attributes__" && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentClassCss}
                  className="text-[10px] font-mono text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded bg-red-900/70 hover:bg-zinc-800/70 border border-zinc-700 transition cursor-pointer ml-4 whitespace-nowrap"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          <div className="h-[160px] w-full relative">
            <Editor
              key={openTarget}
              height="160px"
              theme="vs-dark"
              language={openTarget === "__attributes__" ? "json" : "scss"}
              value={currentText}
              onChange={handleTextChange}
              onMount={handleEditorDidMount}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "var(--font-mono), monospace",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: "on",
                tabSize: 2,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MonacoPropertiesEditor;
