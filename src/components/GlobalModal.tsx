"use client";

import { useSyncExternalStore, useEffect } from "react";
import { modal, ModalType } from "@/lib/modal";

const icons: Record<ModalType, React.ReactNode> = {
  info: (
    <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  ),
  success: (
    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ),
  warning: (
    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
  ),
  error: (
    <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  ),
  confirm: (
    <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  ),
};

const progressColors: Record<ModalType, string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  confirm: "bg-indigo-500",
};

const SERVER_SNAPSHOT = {
  isOpen: false,
  title: "",
  type: "info" as ModalType,
};

const getServerSnapshot = () => SERVER_SNAPSHOT;

export function GlobalModal() {
  const state = useSyncExternalStore(
    modal.subscribe,
    modal.getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.isOpen) {
        modal.close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.isOpen]);

  if (!state.isOpen) return null;

  const isConfirm = state.type === "confirm";
  const duration = state.duration || 2000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => modal.close()}
      />

      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          {icons[state.type || "info"]}

          <div className="flex-1 pt-1">
            <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">
              {state.title}
            </h3>
            {state.message && (
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed whitespace-pre-line">
                {state.message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {isConfirm ? (
            <>
              <button
                type="button"
                onClick={() => modal.close()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
              >
                {state.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => modal.confirmAction()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
              >
                {state.confirmText || "Confirm"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => modal.close()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              Close
            </button>
          )}
        </div>

        {!isConfirm && duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
            <div
              className={`h-full ${progressColors[state.type || "info"]} transition-all`}
              style={{
                animation: `shrinkWidth ${duration}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
