"use client";

import React, { useState } from "react";
import ModalFlexBuilder from "@/app/plaza/components/CanvasArea/components/ModalFlexBuilder";

export default function ButtonAddFlex() {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <>
      <ModalFlexBuilder isOpen={isOpen} setIsOpen={setIsOpen} />
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="grey-btn btn w-full flex items-center justify-center gap-1.5 py-1.5"
      >
        <span>📐</span> Flex Builder
      </button>
    </>
  );
}
