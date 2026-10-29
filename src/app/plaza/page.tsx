import { Suspense } from "react";
import { PreviewArea } from "./components/PreviewArea/PreviewArea";
import { CanvasArea } from "./components/CanvasArea/CanvasArea";

export const metadata = {
  title: "Plaza - Canvas htmlJson Renderer",
  description: "2D Canvas rendering of htmlJson tree from IndexedDB",
};

export default function PlazaPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Suspense
        fallback={
          <div className="w-full h-80 bg-zinc-900/50 rounded-xl animate-pulse" />
        }
      >
        <PreviewArea />
      </Suspense>

      <Suspense
        fallback={
          <div className="w-full h-96 bg-zinc-900/50 rounded-2xl animate-pulse" />
        }
      >
        <CanvasArea />
      </Suspense>
    </div>
  );
}
