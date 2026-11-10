"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ExportStats from "@/app/plaza/export/components/ExportStats";
import Toggle from "@/app/plaza/export/components/Toggle";
import { TABS } from "@/app/plaza/export/lib/constants";
import { useExportController } from "@/app/plaza/export/controllers/useExportController";

const ExportFilePanel = dynamic(
  () => import("@/app/plaza/export/components/ExportFilePanel"),
  { ssr: false },
);

const ExportPreview = dynamic(
  () => import("@/app/plaza/export/components/ExportPreview"),
  { ssr: false },
);

export default function ExportPage() {
  const {
    activeTab,
    setActiveTab,
    bundle,
    isBuilding,
    isPurgeOn,
    setIsPurgeOn,
    isDedupOn,
    setIsDedupOn,
    error,
    handleBuild,
    getContent,
    activeTabMeta,
    handleDownloadActiveTab,
    handleDownloadZip,
    handleDownloadFile,
  } = useExportController();

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* ══ Шапка ══ */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/plaza"
            className="text-zinc-400 hover:text-zinc-200 transition text-sm font-mono flex items-center gap-1"
          >
            ← Plaza
          </Link>
          <span className="text-zinc-700">|</span>
          <span className="text-sm font-mono font-bold text-zinc-200 tracking-wide">
            🚀 Production Export
          </span>
        </div>

        {/* Опции */}
        <div className="flex items-center gap-4 flex-wrap">
          <Toggle
            label="Purge CSS"
            badge="ON"
            value={isPurgeOn}
            onChange={setIsPurgeOn}
            badgeColor="emerald"
          />
          <Toggle
            label="Dedup CSS"
            badge="ON"
            value={isDedupOn}
            onChange={setIsDedupOn}
            badgeColor="violet"
          />
        </div>

        {/* Действия */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleBuild}
            disabled={isBuilding}
            className={`px-4 py-1.5 rounded text-sm font-mono font-bold border transition cursor-pointer flex items-center gap-2 ${
              isBuilding
                ? "bg-indigo-900/40 border-indigo-700/40 text-indigo-400 cursor-wait"
                : "bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-900/40"
            }`}
          >
            {isBuilding ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-indigo-300 border-t-transparent animate-spin" />
                Building…
              </>
            ) : (
              "⚙ Rebuild"
            )}
          </button>

          {bundle && (
            <button
              type="button"
              onClick={handleDownloadZip}
              className="px-4 py-1.5 rounded text-sm font-mono font-bold border transition cursor-pointer flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/30"
            >
              ↓ ZIP
            </button>
          )}
        </div>
      </header>

      {/* ══ Stats bar ══ */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/30 min-h-[40px]">
        {error ? (
          <span className="text-xs font-mono text-red-400">⚠ {error}</span>
        ) : (
          <ExportStats
            stats={bundle?.stats ?? null}
            isPurgeOn={isPurgeOn}
            isDedupOn={isDedupOn}
            isBuilding={isBuilding}
          />
        )}
      </div>

      {/* ══ Tabs ══ */}
      <div className="shrink-0 flex items-end gap-0 px-4 border-b border-zinc-800 bg-zinc-900/30">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const colorClass =
            tab.id === "html"
              ? "border-orange-400 text-orange-300"
              : tab.id === "css"
                ? "border-sky-400 text-sky-300"
                : tab.id === "js"
                  ? "border-amber-400 text-amber-300"
                  : "border-indigo-400 text-indigo-300";
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition cursor-pointer ${
                isActive
                  ? colorClass
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}

        {/* Скачать активный файл */}
        {bundle && activeTab !== "preview" && (
          <div className="ml-auto pb-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownloadActiveTab}
              className="text-[11px] font-mono px-2.5 py-1 rounded border bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-zinc-300 transition cursor-pointer"
            >
              ↓ {activeTabMeta?.filename}
            </button>
          </div>
        )}
      </div>

      {/* ══ Content ══ */}
      <div className="flex-1 overflow-hidden">
        {bundle ? (
          <>
            {/* Preview tab */}
            <div
              className={`h-full ${activeTab === "preview" ? "flex flex-col" : "hidden"}`}
            >
              <ExportPreview previewDoc={bundle.previewDoc} />
            </div>

            {/* Code tabs */}
            {(["html", "css", "js"] as const).map((id) => {
              const tab = TABS.find((t) => t.id === id)!;
              return (
                <div
                  key={id}
                  className={`h-full ${activeTab === id ? "flex flex-col" : "hidden"}`}
                >
                  <ExportFilePanel
                    filename={tab.filename!}
                    content={getContent(id)}
                    language={id === "js" ? "javascript" : id}
                    color={tab.color!}
                    onDownload={() =>
                      handleDownloadFile(tab.filename!, getContent(id))
                    }
                  />
                </div>
              );
            })}
          </>
        ) : (
          /* ── Пустой стейт (пока идёт билд) ── */
          <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-500">
            {isBuilding ? (
              <>
                <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-sm font-mono text-zinc-400">
                  Generating production build…
                </p>
                <p className="text-xs text-zinc-600">
                  Compiling SCSS, purging CSS, bundling JS
                </p>
              </>
            ) : (
              <>
                <div className="text-5xl">🚀</div>
                <p className="text-base font-mono font-semibold text-zinc-400">
                  Production Build
                </p>
                <button
                  type="button"
                  onClick={handleBuild}
                  className="mt-2 px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 text-white font-mono text-sm font-bold cursor-pointer transition"
                >
                  ⚙ Build Now
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
