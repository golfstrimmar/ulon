"use client";

import React, { useState, useEffect } from "react";
import { scriptsHistory } from "@/lib/scriptsHistory";
import { saveGlobalJs } from "@/lib/htmlStorage";

export default function ButtonUndoRedoJs() {
  const [canUndoJs, setCanUndoJs] = useState(false);
  const [canRedoJs, setCanRedoJs] = useState(false);

  useEffect(() => {
    setCanRedoJs(scriptsHistory.canRedo());
    setCanUndoJs(scriptsHistory.canUndo());

    const handleHistoryUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{
        canUndo: boolean;
        canRedo: boolean;
      }>;
      if (customEvent.detail) {
        setCanUndoJs(customEvent.detail.canUndo);
        setCanRedoJs(customEvent.detail.canRedo);
      }
    };

    window.addEventListener(
      "plaza-scripts-history-changed",
      handleHistoryUpdate,
    );
    return () => {
      window.removeEventListener(
        "plaza-scripts-history-changed",
        handleHistoryUpdate,
      );
    };
  }, []);

  // Откат назад
  const handleUndoJs = async () => {
    const prevJs = scriptsHistory.undo();
    if (prevJs !== null) {
      await saveGlobalJs(prevJs);
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: prevJs }),
      );
    }
  };

  // Возврат вперед
  const handleRedoJs = async () => {
    const nextJs = scriptsHistory.redo();
    if (nextJs !== null) {
      await saveGlobalJs(nextJs);
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: nextJs }),
      );
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-zinc-900/90 px-2 py-0.5 rounded-md border border-zinc-700/70">
      <button
        type="button"
        onClick={handleUndoJs}
        disabled={!canUndoJs}
        title="Undo JS change"
        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
      >
        <span>↶</span> Undo
      </button>
      <button
        type="button"
        onClick={handleRedoJs}
        disabled={!canRedoJs}
        title="Redo JS change"
        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
      >
        <span>↷</span> Redo
      </button>
    </div>
  );
}
