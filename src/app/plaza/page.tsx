import { Suspense } from "react";
import { Header } from "@/components/Header";
import { PlazaClient } from "./PlazaClient";

export const metadata = {
  title: "Plaza - htmlJson Renderer",
  description: "Live rendering of htmlJson from browser IndexedDB",
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

      <main className="flex-1 p-6 flex flex-col">
        <Suspense
          fallback={
            <div className="w-full max-w-4xl mx-auto h-64 bg-zinc-900/50 rounded-2xl animate-pulse" />
          }
        >
          <PlazaClient />
        </Suspense>
      </main>
    </div>
  );
}
