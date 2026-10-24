"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
interface ModalCssProps {
  openModalCss: boolean;
  setopenModalCss: any;
}
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ModalCss({
  openModalCss,
  setopenModalCss,
}: ModalCssProps) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {openModalCss && (
        <motion.section
          key="modal-message"
          initial={{ opacity: 0, scale: "20%" }}
          animate={{ opacity: 1, scale: "100%" }}
          exit={{ opacity: 0, scale: "20%" }}
          transition={{ duration: 0.2, ease: [0.25, 0.8, 0.5, 1] }}
          className="fixed top-0 right-0 w-[100vw] h-[100vh]   rounded-sm   overflow-y-auto z-1000 no-scrollbar bg-[color-mix(in_srgb,black_98%,transparent)]"
        >
          <button
            type="button"
            onClick={() => setopenModalCss(!openModalCss)}
            className="absolute top-1 right-2 z-50 w-10 h-10 rounded-lg  hover:bg-red-500 border-2 border-stone-800 text-white text-sm font-bold flex items-center justify-center shadow transition-all cursor-pointer"
          >
            ✕
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
