"use client";

import { useState } from "react";
import { FigmaJsonInput } from "@/app/design/components/FigmaJsonInput";
import { FigmaColorsViewer } from "@/app/design/components/FigmaColorsViewer";
import { FigmaTextsViewer } from "@/app/design/components/FigmaTextsViewer";

export function DesignManager() {
  const [rawJson, setRawJson] = useState("");

  return (
    <div className="flex flex-col gap-8  mx-auto p-6">
      <FigmaJsonInput
        value={rawJson}
        onChange={setRawJson}
        onClear={() => setRawJson("")}
      />
      <FigmaColorsViewer rawJson={rawJson} />
      <FigmaTextsViewer rawJson={rawJson} />
    </div>
  );
}
