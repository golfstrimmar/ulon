import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { prisma } from "@/lib/prisma";

async function AccountHeader() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-indigo-400 font-medium">
        {session.user.name || session.user.email}
      </span>
      <LogoutButton />
    </div>
  );
}

async function AccountDetails() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const dbUser = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
      })
    : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
      <div className="flex items-center gap-4 mb-6 border-b border-zinc-800 pb-6">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="w-16 h-16 rounded-full border border-zinc-700 object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold text-2xl flex items-center justify-center">
            {(session.user.name || session.user.email || "U")[0].toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Личный кабинет
          </h1>
          <p className="text-sm text-zinc-400">
            Данные вашей учетной записи
          </p>
        </div>
      </div>

      <div className="space-y-4 text-sm">
        <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80 flex flex-col gap-1">
          <span className="text-xs uppercase font-medium text-zinc-500">
            ID:
          </span>
          <span className="font-mono text-zinc-200 break-all">
            {session.user.id}
          </span>
        </div>

        <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80 flex flex-col gap-1">
          <span className="text-xs uppercase font-medium text-zinc-500">
            Имя:
          </span>
          <span className="text-zinc-100 font-medium">
            {session.user.name || "Не указано"}
          </span>
        </div>

        <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80 flex flex-col gap-1">
          <span className="text-xs uppercase font-medium text-zinc-500">
            Email:
          </span>
          <span className="text-zinc-100 font-medium">
            {session.user.email}
          </span>
        </div>

        {dbUser?.createdAt && (
          <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80 flex flex-col gap-1">
            <span className="text-xs uppercase font-medium text-zinc-500">
              Дата регистрации:
            </span>
            <span className="text-zinc-300">
              {new Date(dbUser.createdAt).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 pt-4 border-t border-zinc-800 flex justify-between items-center">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-white transition flex items-center gap-1.5"
        >
          ← На главную
        </Link>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          <span className="font-bold text-xl tracking-tight text-white">
            Ulon
          </span>
        </Link>
        <Suspense
          fallback={
            <div className="h-8 w-24 bg-zinc-800/50 rounded animate-pulse" />
          }
        >
          <AccountHeader />
        </Suspense>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-6 flex flex-col justify-center">
        <Suspense
          fallback={
            <div className="h-64 w-full bg-zinc-900/50 rounded-2xl animate-pulse" />
          }
        >
          <AccountDetails />
        </Suspense>
      </main>
    </div>
  );
}
