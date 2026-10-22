import { Suspense } from "react";
import { Header } from "@/components/Header";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Suspense
        fallback={
          <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
            <span className="font-bold text-xl tracking-tight text-white">Ulon</span>
            <div className="h-8 w-24 bg-zinc-800/50 rounded-full animate-pulse" />
          </header>
        }
      >
        <Header />
      </Suspense>

      <main className="flex-1 flex items-center justify-center p-4">
        <RegisterForm />
      </main>
    </div>
  );
}
