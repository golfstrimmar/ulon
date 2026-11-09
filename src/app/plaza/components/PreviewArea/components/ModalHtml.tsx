"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import ButtonClose from "@/components/ButtonClose";

interface ModalHtmlProps {
  openModalHtml: boolean;
  setOpenModalHtml: (open: boolean) => void;
  srcDoc: string;
}

export default function ModalHtml({
  openModalHtml,
  setOpenModalHtml,
  srcDoc,
}: ModalHtmlProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (srcDoc) {
      navigator.clipboard.writeText(srcDoc).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      }).catch(console.error);
    }
  };

  return (
    <AnimatePresence initial={false} mode="wait">
      {openModalHtml && (
        <motion.section
          key="modal-html"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 w-screen h-screen z-[1000] bg-zinc-950/95 backdrop-blur-md flex flex-col p-4"
        >
          {/* Шапка */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold text-orange-300 flex items-center gap-1.5">
                <span>🌐</span> Full HTML Document
              </span>
              <span className="text-xs font-mono text-zinc-500 hidden sm:inline border-l border-zinc-700 pl-3">
                read-only · full &lt;!DOCTYPE html&gt; as rendered in iframe
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                title="Copy full HTML to clipboard"
                className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isCopied
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : "bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-zinc-200"
                }`}
              >
                {isCopied ? "✓ Copied!" : "📋 Copy"}
              </button>
              <ButtonClose setClose={setOpenModalHtml} />
            </div>
          </div>

          {/* Monaco — read-only, полный HTML */}
          <div className="flex-1 w-full rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-[#1e1e1e]">
            <Editor
              height="100%"
              language="html"
              theme="vs-dark"
              value={srcDoc}
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                lineNumbers: "on",
                wordWrap: "off",
                padding: { top: 10, bottom: 10 },
                domReadOnly: true,
              }}
            />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
