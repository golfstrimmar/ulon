"use client";

import { useEffect } from "react";
import { useFigmaTextsController } from "../controllers/useFigmaTextsController";

interface FigmaTextsViewerProps {
  rawJson: string;
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
      {/* Индикатор базы цветов */}
      <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5">
        <span>
          База переменных цвета:{" "}
          <strong className="text-zinc-200">
            {isColorsLoaded ? `Загружено (${colorMapSize})` : "Загрузка..."}
          </strong>
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
          ⚠️ Ошибка текстов: {error}
        </p>
      )}

      {/* Список нод с кнопками отправки в дерево */}
      {nodes.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">
              Сформированные HtmlNode ({nodes.length})
            </h2>
            <button
              type="button"
              onClick={appendAllNodes}
              disabled={savingKey === "all"}
              className="text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium px-3.5 py-1.5 rounded-lg border border-blue-400/20 transition shadow-sm"
            >
              {savingKey === "all"
                ? "Добавлено в дерево!"
                : "Закинуть все ноды в базу"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {nodes.map((node) => {
              const isSaved = savingKey === node._key;

              return (
                <div
                  key={node._key}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-400 uppercase bg-blue-950/50 border border-blue-800/60 px-2 py-0.5 rounded">
                        {node.tag}
                      </span>
                      <span className="font-mono text-xs text-zinc-500">
                        key: {node._key}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => appendSingleNode(node)}
                      disabled={isSaved}
                      className={`text-xs px-2.5 py-1 rounded transition border ${
                        isSaved
                          ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                          : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200"
                      }`}
                    >
                      {isSaved ? "Добавлено!" : "Добавить в дерево"}
                    </button>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3">
                    <p className="text-sm font-medium text-white mb-2">
                      {node.text}
                    </p>
                    <div className="font-mono text-xs text-emerald-400 break-all">
                      <span className="text-zinc-500">style:</span> {node.style}
                    </div>
                    {node.class && (
                      <div className="font-mono text-xs text-amber-400 break-all mt-1">
                        <span className="text-zinc-500">class:</span>{" "}
                        {node.class}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
