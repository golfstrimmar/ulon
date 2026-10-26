"use client";
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ButtonClose from "@/components/ButtonClose";

//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ModalAddImg({ isOpen, setIsOpen }) {
  // 🔹 Блокировка скролла body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Сброс при размонтировании компонента
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0, y: 0 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="fixed top-0 left-0 w-[100vw] min-h-[100vh] bg-black/98 z-1000 no-scrollbar"
        >
          <div className="absolute top-2 right-6">
            <ButtonClose setClose={setIsOpen} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
