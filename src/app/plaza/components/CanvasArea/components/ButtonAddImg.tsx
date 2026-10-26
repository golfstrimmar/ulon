"use client";
import React, { useState } from "react";
import ModalAddImg from "@/app/plaza/components/CanvasArea/components/ModalAddImg";
import ModalAddSvg from "@/app/plaza/components/CanvasArea/components/ModalAddSvg";

//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonAddImg() {
  const [isOpenImg, setIsOpenImg] = useState<boolean>(false);
  const [isOpenSvg, setIsOpenSvg] = useState<boolean>(false);

  return (
    <>
      <ModalAddImg isOpen={isOpenImg} setIsOpen={setIsOpenImg} />
      <ModalAddSvg isOpen={isOpenSvg} setIsOpen={setIsOpenSvg} />
      <div className="grid grid-cols-2 items-center gap-2">
        <button className="grey-btn btn" onClick={() => setIsOpenImg(true)}>
          🖼️ Add Img
        </button>
        <button className="grey-btn btn" onClick={() => setIsOpenSvg(true)}>
          🧩 Add SVG
        </button>
      </div>
    </>
  );
}
