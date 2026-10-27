"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import ModalJsonHtml from "@/app/plaza/components/PreviewArea/components/ModalJsonHtml";
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonJson() {
  const [openModalJson, setopenModalJson] = useState<boolean>(false);

  return (
    <div className="">
      <button
        className="text-[10px] font-mono px-2 py-0.5 rounded border transition duration-200 cursor-pointer flex items-center gap-1.5"
        onClick={() => setopenModalJson(!openModalJson)}
      >
        See jsonHTML
      </button>
      <ModalJsonHtml
        openModalJson={openModalJson}
        setopenModalJson={setopenModalJson}
      />
    </div>
  );
}
