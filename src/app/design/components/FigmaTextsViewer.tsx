"use client";

import { useEffect } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { useFigmaTextsController } from "../controllers/useFigmaTextsController";

interface FigmaTextsViewerProps {
  rawJson: string;
}

function NodeCard({
  node,
  savingKey,
  onAppend,
  depth = 0,
}: {
  node: HtmlNode;
  savingKey: string | null;
  onAppend: (node: HtmlNode) => void;
  depth?: number;
}) {
  const isSaved = savingKey === node._key;
  const childrenList = Array.isArray(node.children) ? node.children : [];

  return (
    <div
      className={`border rounded-xl p-4 flex flex-col gap-3 shadow-sm ${
        depth === 0
          ? "bg-zinc-900 border-zinc-800"
          : "bg-zinc-950/80 border-zinc-800/80 mt-2"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-mono text-xs font-bold uppercase px-2 py-0.5 rounded border ${
              node.tag === "div"
                ? "text-purple-400 bg-purple-950/50 border-purple-800/60"
                : "text-blue-400 bg-blue-950/50 border-blue-800/60"
            }`}
          >
            {node.tag}
          </span>
          {node.attributes?.["data-name"] && (
            <span className="text-xs font-semibold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
              {node.attributes["data-name"]}
            </span>
          )}
          {childrenList.length > 0 && (
            <span className="text-xs text-zinc-400">
              ({childrenList.length} вложенных)
            </span>
          )}
          <span className="font-mono text-xs text-zinc-500">
            key: {node._key}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAppend(node)}
          disabled={isSaved}
          className={`text-xs px-2.5 py-1 rounded transition border ${
            isSaved
              ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
              : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200"
          }`}
        >
          {isSaved ? "Добавлено!" : "В дерево"}
        </button>
      </div>

      {(node.text || node.style || node.class) && (
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3">
          {node.text && (
            <p className="text-sm font-medium text-white mb-2">{node.text}</p>
          )}
          {node.style && (
            <div className="font-mono text-xs text-emerald-400 break-all">
              <span className="text-zinc-500">style:</span> {node.style}
            </div>
          )}
          {node.class && (
            <div className="font-mono text-xs text-amber-400 break-all mt-1">
              <span className="text-zinc-500">class:</span> {node.class}
            </div>
          )}
        </div>
      )}

      {childrenList.length > 0 && (
        <div className="flex flex-col gap-2 pl-3 border-l-2 border-zinc-800">
          {childrenList.map((child) => (
            <NodeCard
              key={child._key}
              node={child}
              savingKey={savingKey}
              onAppend={onAppend}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FigmaTextsViewer({ rawJson }: FigmaTextsViewerProps) {
  const {
    nodes,
    error,
    isColorsLoaded,
    colorMapSize,
    savingKey,
    processJson,
    appendSingleNode,
    appendAllNodes,
  } = useFigmaTextsController();

  useEffect(() => {
    processJson(rawJson);
  }, [rawJson, processJson]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Color variables indicator */}
      <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5">
        <span>
          База цветовых переменных:{" "}
          <strong className="text-zinc-200">
            {isColorsLoaded ? `Загружено (${colorMapSize})` : "Загрузка..."}
          </strong>
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
          ⚠️ Ошибка: {error}
        </p>
      )}

      {/* Node list with buttons for sending to the tree */}
      {nodes.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">
              Сформированные блоки/ноды ({nodes.length})
            </h2>
            <button
              type="button"
              onClick={appendAllNodes}
              disabled={savingKey === "all"}
              className="text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium px-3.5 py-1.5 rounded-lg border border-blue-400/20 transition shadow-sm"
            >
              {savingKey === "all"
                ? "Добавлено в дерево!"
                : "Добавить всё в дерево"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {nodes.map((node) => (
              <NodeCard
                key={node._key}
                node={node}
                savingKey={savingKey}
                onAppend={appendSingleNode}
                depth={0}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
