"use client";
import React from "react";

interface ButtonCloseProps {
  setClose: (open: boolean) => void;
}
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonClose({ setClose }: ButtonCloseProps) {
  return (
    <button
      type="button"
      onClick={() => setClose(false)}
      className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-red-600 border border-zinc-700 text-white text-sm font-bold flex items-center justify-center transition-all cursor-pointer"
    >
      ✕
    </button>
  );
}
// import ButtonClose from "@/components/ButtonClose";
// <ButtonClose setClose={setopenModalCss} />
