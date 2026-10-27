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

  // ====>====>====>====>====>====>====>====>====>====>====>====>====>====>====>
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
  ///  ───────────────────────────────────────────────────────

  // const [isSaving, setIsSaving] = useState<boolean>(false);
  // const [isSaved, setIsSaved] = useState<boolean>(false);

  // const [canUndo, setCanUndo] = useState<boolean>(false);
  // const [canRedo, setCanRedo] = useState<boolean>(false);
  // const editorRef = useRef<any>(null);

  // Загрузка начального кода и подписка на состояние истории
  // useEffect(() => {
  //   if (openModalCss) {
  //     getGlobalScss().then((code) => {
  //       const val = code || "";
  //       setScssCode(val);
  //       setIsSaved(false);
  //       setCanUndo(styleHistory.canUndo());
  //       setCanRedo(styleHistory.canRedo());
  //     });
  //   }

  //   const handleHistoryUpdate = (e: Event) => {
  //     const customEvent = e as CustomEvent<{
  //       canUndo: boolean;
  //       canRedo: boolean;
  //     }>;
  //     if (customEvent.detail) {
  //       setCanUndo(customEvent.detail.canUndo);
  //       setCanRedo(customEvent.detail.canRedo);
  //     }
  //   };

  //   window.addEventListener("plaza-style-history-changed", handleHistoryUpdate);
  //   return () => {
  //     window.removeEventListener(
  //       "plaza-style-history-changed",
  //       handleHistoryUpdate,
  //     );
  //   };
  // }, [openModalCss]);

  // Сохранение (Save)
  // const handleSave = async (codeToSave = scssCode) => {
  //   try {
  //     setIsSaving(true);
  //     styleHistory.record(codeToSave); // 🔹 Фиксируем шаг в истории
  //     await saveGlobalScss(codeToSave);

  //     window.dispatchEvent(
  //       new CustomEvent("plaza-styles-updated", { detail: codeToSave }),
  //     );

  //     setIsSaved(true);
  //     setTimeout(() => setIsSaved(false), 800);
  //   } catch (err) {
  //     console.error("[ModalCss] Failed to save SCSS to IndexedDB:", err);
  //   } finally {
  //     setIsSaving(false);
  //   }
  // };

  // // 🔹 Откат назад (Undo)
  // const handleUndo = async () => {
  //   const prevScss = styleHistory.undo();
  //   if (prevScss !== null) {
  //     setScssCode(prevScss);
  //     await saveGlobalScss(prevScss);
  //     window.dispatchEvent(
  //       new CustomEvent("plaza-styles-updated", { detail: prevScss }),
  //     );
  //   }
  // };

  // // 🔹 Возврат вперед (Redo)
  // const handleRedo = async () => {
  //   const nextScss = styleHistory.redo();
  //   if (nextScss !== null) {
  //     setScssCode(nextScss);
  //     await saveGlobalScss(nextScss);
  //     window.dispatchEvent(
  //       new CustomEvent("plaza-styles-updated", { detail: nextScss }),
  //     );
  //   }
  // };

  // const handleEditorDidMount = (editor: any, monaco: any) => {
  //   editorRef.current = editor;
  //   editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
  //     handleSave();
  //   });
  // };

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
