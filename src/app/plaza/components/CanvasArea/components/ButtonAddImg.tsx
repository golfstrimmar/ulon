"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";

import ModalAddImg from "@/app/plaza/components/CanvasArea/components/ModalAddImg";

//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonAddImg() {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <>
      <ModalAddImg isOpen={isOpen} setIsOpen={setIsOpen} />
      <div className="grid grid-cols-2 items-center  gap-2">
        <button className={`grey-btn btn `} onClick={() => setIsOpen(!isOpen)}>
          🖼️ Add Img
        </button>
        <button className={`grey-btn btn `}>🧩 Add SVG</button>
      </div>
    </>
  );
}
