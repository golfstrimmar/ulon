"use client";

import React, { useRef, useState } from "react";
import Editor from "@monaco-editor/react";

interface ExportFilePanelProps {
  filename: string;
  content: string;
  language: "html" | "css" | "javascript";
  color: "orange" | "sky" | "amber";
  onDownload: () => void;
}

const colorMap = {
  orange: {
    label: "text-orange-300",
    badge: "bg-orange-950/60 border-orange-600/50 text-orange-300",
    btn: "bg-orange-700 hover:bg-orange-600 border-orange-500 text-white",
  },
  sky: {
    label: "text-sky-300",
    badge: "bg-sky-950/60 border-sky-600/50 text-sky-300",
    btn: "bg-sky-700 hover:bg-sky-600 border-sky-500 text-white",
  },
  amber: {
    label: "text-amber-300",
    badge: "bg-amber-950/60 border-amber-600/50 text-amber-300",
    btn: "bg-amber-700 hover:bg-amber-600 border-amber-500 text-white",
  },
};

export default function ExportFilePanel({
  filename,
  content,
  language,
  color,
  onDownload,
}: ExportFilePanelProps) {
  const [isCopied, setIsCopied] = useState(false);
  const c = colorMap[color];

  const bytes = new TextEncoder().encode(content).length;
  const sizeStr =
    bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Мини-шапка панели */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-sm ${c.label}`}>
            {filename}
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${c.badge}`}>
            {sizeStr}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className={`text-[11px] font-mono px-2 py-1 rounded border transition cursor-pointer ${
              isCopied
                ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                : "bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-zinc-300"
            }`}
          >
            {isCopied ? "✓ Copied" : "📋 Copy"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            className={`text-[11px] font-mono px-2 py-1 rounded border transition cursor-pointer ${c.btn}`}
          >
            ↓ Download
          </button>
        </div>
      </div>

      {/* Monaco */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={content}
          options={{
            readOnly: true,
            domReadOnly: true,
            fontSize: 12,
            fontFamily: "monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            lineNumbers: "on",
            wordWrap: "off",
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: "none",
          }}
        />
      </div>
    </div>
  );
}
