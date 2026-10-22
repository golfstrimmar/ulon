import { auth } from "@/auth";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
      <Link
        href="/"
        className="flex items-center gap-2 hover:opacity-80 transition"
      >
        <span className="font-bold text-xl tracking-tight text-white">Ulon</span>
      </Link>

      <div>
        {session?.user ? (
          <div className="flex items-center gap-4">
            <Link
              href="/account"
              className="group flex items-center gap-2.5 py-1 px-2.5 rounded-full bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-indigo-500/50 transition"
              title="Открыть личный кабинет"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "Аватар"}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-zinc-600 group-hover:border-indigo-400 transition"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center">
                  {(session.user.name || session.user.email || "U")[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition max-w-[160px] truncate">
                {session.user.name || session.user.email}
              </span>
            </Link>

            <LogoutButton />
          </div>
        ) : (
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
        )}
      </div>
    </header>
  );
}
