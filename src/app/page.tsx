import { auth } from "@/auth";
import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { WelcomeToast } from "@/components/WelcomeToast";

async function MainContent() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          Welcome back, {session.user.name || "user"}!
        </h1>
        <p className="text-zinc-400 text-lg">
          You are signed in to Ulon.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href="/account"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2.5 rounded-xl shadow-lg transition"
          >
            Go to profile →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold tracking-tight text-white">
        Welcome to Ulon
      </h1>
      <p className="text-zinc-400 text-lg">
        Authentication is ready: NextAuth v5, PostgreSQL on Neon and Prisma ORM.
      </p>
      <div className="flex justify-center gap-4 pt-2">
        <Link
          href="/register"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2.5 rounded-xl shadow-lg transition"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium px-6 py-2.5 rounded-xl transition"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>

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

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
        <Suspense
          fallback={
            <div className="h-40 w-full bg-zinc-900/50 rounded-2xl animate-pulse" />
          }
        >
          <MainContent />
        </Suspense>
      </main>
    </div>
  );
}
