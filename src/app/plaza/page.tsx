import { Suspense } from "react";
import { Header } from "@/components/Header";
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
          <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
            <span className="font-bold text-xl tracking-tight text-white">Ulon</span>
            <div className="h-8 w-28 bg-zinc-800/50 rounded-full animate-pulse" />
          </header>
        }
      >
        <Header />
      </Suspense>

      <main className="flex-1 p-4 sm:p-6 flex flex-col max-w-7xl w-full mx-auto">
        <Suspense
          fallback={
            <div className="w-full h-96 bg-zinc-900/50 rounded-2xl animate-pulse" />
          }
        >
          <CanvasArea />
        </Suspense>
      </main>
    </div>
  );
}
