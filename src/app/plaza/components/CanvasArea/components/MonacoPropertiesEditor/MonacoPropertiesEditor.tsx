"use client";

import React from "react";
import dynamic from "next/dynamic";
import ModalCustomStyles from "@/app/plaza/components/CanvasArea/components/ModalCustomStyles/ModalCustomStyles";
import ButtonUndoRedoScss from "@/components/ButtonUndoRedoScss";
import { useMonacoPropertiesEditor } from "./useMonacoPropertiesEditor";
import { hasClassInScss, extractClassSnippet } from "@/lib/scssCompiler";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] w-full flex items-center justify-center bg-zinc-950 text-xs font-mono text-zinc-500">
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
  onClearNodeStyle?: () => Promise<void> | void;
  onSaveAttributes?: (
    attributes: Record<string, string>,
  ) => Promise<void> | void;
}

export function MonacoPropertiesEditor(props: MonacoPropertiesEditorProps) {
  const { nodeClasses, globalScss } = props;

  const {
    mode,
    activeModalClass,
    isCustomStylesOpen,
    activeScope,
    currentText,
    attrsCount,
    setIsCustomStylesOpen,
    setActiveScope,
    handleClassButtonClick,
    handleCloseCustomStyles,
    handleShowStylesTab,
    handleToggleAttributes,
    handleDeleteClassCss,
    handleApplySnippetForClass,
    handleTextChange,
    handleEditorDidMount,
  } = useMonacoPropertiesEditor(props);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* ══ Classes & Attributes Header Bar (Browser DevTools Styles Tab) ══ */}
      <div className="flex flex-wrap  items-center gap-1.5 p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono tracking-wider text-zinc-400 font-semibold mr-1 shrink-0">
            Classes:
          </span>

          {nodeClasses.length > 0 ? (
            nodeClasses.map((cls) => {
              const hasSnippet = hasClassInScss(globalScss, cls);
              const isModalActive =
                isCustomStylesOpen && activeModalClass === cls;

              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => handleClassButtonClick(cls)}
                  title={`Open visual style editor for .${cls}`}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 ${
                    isModalActive
                      ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow"
                      : hasSnippet
                        ? "bg-zinc-900 border-zinc-700 text-emerald-400 hover:bg-zinc-800 hover:border-indigo-500"
                        : "bg-zinc-900 border-zinc-750 text-zinc-300 hover:bg-zinc-800 hover:border-indigo-500"
                  }`}
                >
                  <span>.{cls}</span>
                  <span className="text-[10px] opacity-75">🎨</span>
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

        <div className="flex items-center gap-1.5">
          {/* Кнопка переключения в редактор стилей (все классы) */}
          <button
            type="button"
            onClick={handleShowStylesTab}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1 font-bold ${
              mode === "styles"
                ? "bg-indigo-600 border-indigo-400 text-white shadow"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Show all CSS rules for element classes in Monaco"
          >
            <span>🎨 Styles</span>
          </button>

          {/* Кнопка переключения в редактор атрибутов */}
          <button
            type="button"
            onClick={handleToggleAttributes}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 font-bold ${
              mode === "attributes"
                ? "bg-indigo-600 border-indigo-400 text-white shadow"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Edit HTML attributes in JSON"
          >
            <span>⚙️ Attributes</span>
            {attrsCount > 0 && (
              <span className="px-1 py-0.1 bg-indigo-950 border border-indigo-700/80 text-indigo-300 rounded-full text-[9px]">
                {attrsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ══ Editor Body ══ */}
      <div className="w-full flex flex-col rounded-lg border border-indigo-500/60 bg-zinc-950 overflow-hidden shadow-xl">
        <div className="flex items-center px-3 py-1.5 bg-indigo-950/70 border-b border-indigo-900/60 select-none">
          {mode === "styles" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-zinc-300 font-semibold flex items-center gap-1.5">
                <span className="text-cyan-400">Styles</span>
                <span className="text-zinc-500">|</span>
                {activeModalClass ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/60">
                    <span>Active: .{activeModalClass}</span>
                    <button
                      type="button"
                      onClick={handleCloseCustomStyles}
                      className="text-zinc-400 hover:text-red-400 text-[10px] ml-0.5 cursor-pointer font-bold"
                      title="Deselect active class"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="text-zinc-400">All Classes</span>
                )}
              </span>

              {/* Рендерим панель ModalCustomStyles ТОЛЬКО когда есть активный класс */}
              {activeModalClass && (
                <ModalCustomStyles
                  currentClass={activeModalClass}
                  currentScssText={extractClassSnippet(
                    globalScss,
                    activeModalClass,
                  )}
                  activeScope={activeScope}
                  isOpen={isCustomStylesOpen}
                  onOpenChange={(open) => {
                    if (!open) {
                      handleCloseCustomStyles();
                    } else {
                      setIsCustomStylesOpen(true);
                    }
                  }}
                  onScopeChange={setActiveScope}
                  onApplySnippet={(snippet) =>
                    handleApplySnippetForClass(activeModalClass, snippet)
                  }
                />
              )}
            </div>
          ) : (
            <span className="text-[11px] font-mono text-indigo-300 font-semibold">
              ⚙️ Attributes (JSON)
            </span>
          )}

          <div className="flex items-center gap-2">
            <ButtonUndoRedoScss />
            {mode === "styles" && activeModalClass && (
              <button
                type="button"
                onClick={() => handleDeleteClassCss(activeModalClass)}
                className="text-[10px] font-mono text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded bg-red-900/70 hover:bg-zinc-800/70 border border-zinc-700 transition cursor-pointer whitespace-nowrap ml-2"
                title={`Clear CSS for .${activeModalClass}`}
              >
                ✕ Clear .{activeModalClass}
              </button>
            )}
          </div>
        </div>

        {/* Monaco Editor: показывает все стили ноды по классам */}
        <div className="h-[220px] w-full relative">
          <Editor
            key={mode}
            height="220px"
            theme="vs-dark"
            language={mode === "attributes" ? "json" : "scss"}
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
    </div>
  );
}

export default MonacoPropertiesEditor;
