import { auth } from "@/auth";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { WelcomeToast } from "@/components/WelcomeToast";

async function UserNav() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/account"
          className="text-sm text-zinc-300 hover:text-indigo-400 font-medium transition hover:underline underline-offset-4 flex items-center gap-2"
          title="Открыть личный кабинет"
        >
          {session.user.image && (
            <img
              src={session.user.image}
              alt=""
              className="w-6 h-6 rounded-full object-cover border border-zinc-700"
            />
          )}
          <span>{session.user.name || session.user.email}</span>
        </Link>
        <LogoutButton />
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
      <div className="space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          Добро пожаловать, {session.user.name || "пользователь"}!
        </h1>
        <p className="text-zinc-400 text-lg">
          Вы успешно авторизованы в системе Ulon.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href="/account"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2.5 rounded-xl shadow-lg transition"
          >
            Перейти в личный кабинет →
          </Link>
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
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>

      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xl tracking-tight text-white">
            Ulon
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
