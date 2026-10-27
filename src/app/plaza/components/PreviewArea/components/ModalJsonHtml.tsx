"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { getGlobalScss, saveGlobalScss } from "@/lib/htmlStorage";
import { styleHistory } from "@/lib/styleHistory";
import Spinner from "@/components/Spinner";
import ButtonClose from "@/components/ButtonClose";
import { getAllHtmlJson } from "@/lib/htmlStorage";
interface ModalJsonHtmlProps {
  openModalJson: boolean;
  setopenModalJson: (open: boolean) => void;
}

export default function ModalJsonHtml({
  openModalJson,
  setopenModalJson,
}: ModalJsonHtmlProps) {
  const [Json, setJson] = useState<string>("");
  useEffect(() => {
    if (openModalJson) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [openModalJson]);

  useEffect(() => {
    const run = async () => {
      try {
        const result = await getAllHtmlJson();
        setJson(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error("Error", error);
      }
    };

    run();
  }, [openModalJson]);
  // ====>====>====>====>====>====>====>====>====>====>====>====>====>====>====>
  return (
    <AnimatePresence initial={false} mode="wait">
      {openModalJson && (
        <motion.section
          key="modal-json"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 w-screen h-screen z-[1000] bg-zinc-950/95 backdrop-blur-md flex flex-col p-4 overflow-y-scroll"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold text-zinc-200">
                jsonHTML (for viewing only)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ButtonClose setClose={setopenModalJson} />
            </div>
            {}
          </div>
          {Json.length > 0 && <pre>{Json}</pre>}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
