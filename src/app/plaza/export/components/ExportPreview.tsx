"use client";

import React, { useRef, useEffect, useState } from "react";

interface ExportPreviewProps {
  previewDoc: string;
}

const BREAKPOINTS = [
  { label: "Full", width: "100%", icon: "🖥" },
  { label: "1280", width: "1280px", icon: "💻" },
  { label: "1024", width: "1024px", icon: "🖥" },
  { label: "768",  width: "768px",  icon: "📱" },
  { label: "375",  width: "375px",  icon: "📲" },
] as const;

type BpLabel = (typeof BREAKPOINTS)[number]["label"];

export default function ExportPreview({ previewDoc }: ExportPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeWidth, setActiveWidth] = useState<BpLabel>("Full");
  const [iframeHeight, setIframeHeight] = useState(600);

  // При изменении previewDoc обновляем srcDoc без перемонтирования
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (doc?.body) {
        const h = doc.body.scrollHeight;
        if (h > 0) setIframeHeight(Math.max(400, h));
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, []);

  const bp = BREAKPOINTS.find((b) => b.label === activeWidth) ?? BREAKPOINTS[0];
  const isFullWidth = bp.width === "100%";

  return (
    <div className="flex flex-col h-full">
      {/* Мини-тулбар */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-300">
          <span className="text-green-400 font-bold">●</span>
          <span className="text-zinc-500">Live preview of production build</span>
        </div>

        {/* Breakpoint switcher */}
        <div className="flex items-center gap-1">
          {BREAKPOINTS.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => setActiveWidth(b.label)}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition cursor-pointer ${
                activeWidth === b.label
                  ? "bg-indigo-600/30 border-indigo-500/60 text-indigo-300"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Iframe container */}
      <div
        className={`flex-1 overflow-auto ${
          isFullWidth ? "bg-white" : "bg-zinc-900 p-4 flex justify-center"
        }`}
      >
        <div
          className={`${
            isFullWidth
              ? "w-full h-full"
              : "bg-white shadow-2xl rounded border border-zinc-700 shrink-0 overflow-hidden"
          }`}
          style={isFullWidth ? {} : { width: bp.width }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={previewDoc}
            title="Production Preview"
            sandbox="allow-scripts allow-same-origin"
            className="w-full border-0 block"
            style={{
              height: isFullWidth ? "100%" : `${iframeHeight}px`,
              minHeight: "400px",
            }}
          />
        </div>
      </div>
    </div>
  );
}
