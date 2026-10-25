"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import { styleHistory } from "@/lib/styleHistory";
import { saveGlobalScss } from "@/lib/htmlStorage";
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────

export default function ButtonUndoRedoScss() {
  const [canUndoStyles, setCanUndoStyles] = useState(false);
  const [canRedoStyles, setCanRedoStyles] = useState(false);

  // Подписываемся на состояние истории стилей
  useEffect(() => {
    setCanRedoStyles(styleHistory.canRedo());
    setCanUndoStyles(styleHistory.canUndo());
    const handleHistoryUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{
        canUndo: boolean;
        canRedo: boolean;
      }>;
      if (customEvent.detail) {
        setCanUndoStyles(customEvent.detail.canUndo);
        setCanRedoStyles(customEvent.detail.canRedo);
      }
    };

    window.addEventListener("plaza-style-history-changed", handleHistoryUpdate);
    return () => {
      window.removeEventListener(
        "plaza-style-history-changed",
        handleHistoryUpdate,
      );
    };
  }, []);
  // Откат стилей назад
  const handleUndoStyles = async () => {
    const prevScss = styleHistory.undo();
    if (prevScss !== null) {
      await saveGlobalScss(prevScss);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: prevScss }),
      );
    }
  };

  // Возврат стилей вперед
  const handleRedoStyles = async () => {
    const nextScss = styleHistory.redo();
    if (nextScss !== null) {
      await saveGlobalScss(nextScss);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: nextScss }),
      );
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-zinc-900/90 px-2 py-0.5 rounded-md border border-zinc-700/70">
      <button
        type="button"
        onMouseEnter={handleUndoStyles}
        disabled={!canUndoStyles}
        title="Undo CSS change"
        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
      >
        <span>↶</span> Undo
      </button>
      <button
        type="button"
        onMouseEnter={handleRedoStyles}
        disabled={!canRedoStyles}
        title="Redo CSS change"
        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
      >
        <span>↷</span> Redo
      </button>
    </div>
  );
}
