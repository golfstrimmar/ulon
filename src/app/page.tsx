import { auth, signOut } from "@/auth";
import Link from "next/link";
import { Suspense } from "react";

async function UserNav() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-300">
          {session.user.name || session.user.email}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            Выйти
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="text-sm text-zinc-300 hover:text-white px-3 py-1.5 transition"
      >
        Войти
      </Link>
      <Link
        href="/register"
        className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg font-medium transition shadow"
      >
        Регистрация
      </Link>
    </div>
  );
}

async function MainContent() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full shadow-xl text-left">
        <h2 className="text-xl font-semibold text-white mb-4">
          🎉 Вы успешно авторизованы!
        </h2>
        <div className="space-y-3 text-sm text-zinc-300 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
          <div>
            <span className="text-zinc-500">ID:</span> {session.user.id}
          </div>
          <div>
            <span className="text-zinc-500">Имя:</span> {session.user.name}
          </div>
          <div>
            <span className="text-zinc-500">Email:</span> {session.user.email}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold tracking-tight text-white">
        Добро пожаловать в Ulon
      </h1>
      <p className="text-zinc-400 text-lg">
        Авторизация и регистрация настроены: NextAuth v5, PostgreSQL на Neon и Prisma ORM.
      </p>
      <div className="flex justify-center gap-4 pt-2">
        <Link
          href="/register"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2.5 rounded-xl shadow-lg transition"
        >
          Создать аккаунт
        </Link>
        <Link
          href="/login"
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium px-6 py-2.5 rounded-xl transition"
        >
          Войти в систему
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xl tracking-tight text-white">
            Ulon
          </span>
          <span className="text-xs bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 px-2 py-0.5 rounded-full">
            Auth v5 + Neon
          </span>
        </div>

        <Suspense
          fallback={
            <div className="h-8 w-24 bg-zinc-800/50 rounded animate-pulse" />
          }
        >
          <UserNav />
        </Suspense>
      </header>

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
