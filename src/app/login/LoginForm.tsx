"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { modal } from "@/lib/modal";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    urlError === "OAuthAccountNotLinked"
      ? "Этот email уже был зарегистрирован через пароль. Попробуйте войти через Google ещё раз (аккаунты будут связаны)."
      : urlError
        ? "Ошибка авторизации: " + urlError
        : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (urlError === "OAuthAccountNotLinked") {
      modal.warning(
        "Аккаунт уже существует",
        "Этот email уже был зарегистрирован через пароль. Войдите через Google ещё раз, и аккаунты будут автоматически объединены."
      );
    } else if (urlError) {
      modal.error("Ошибка авторизации", `Код ошибки: ${urlError}`);
    } else if (registered) {
      modal.success("Успешная регистрация!", "Ваш аккаунт создан. Войдите, используя email и пароль.");
    }
  }, [urlError, registered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        const msg = "Неверный email или пароль";
        setError(msg);
        await modal.error("Ошибка входа", msg, 2000);
      } else {
        router.push("/?welcome=1");
        router.refresh();
      }
    } catch (err: any) {
      const msg = "Не удалось выполнить вход. Попробуйте снова.";
      setError(msg);
      await modal.error("Сбой сервера", msg, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    modal.info("Google Авторизация", "Перенаправляем на страницу входа Google...", 1500);
    signIn("google", { callbackUrl: "/?welcome=1" });
  };

  return (
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Вход в систему</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Введите учетные данные для продолжения
        </p>
      </div>

      {registered && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-sm">
          Аккаунт успешно создан! Войдите, используя свой email и пароль.
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@mail.com"
            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Пароль
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-zinc-900 px-3 text-zinc-500">или</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 font-medium flex items-center justify-center gap-3 transition cursor-pointer"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
          />
          <path
            fill="#FBBC05"
            d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c0-1.7 0-3.3 0-5z"
          />
          <path
            fill="#34A853"
            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
          />
        </svg>
        Войти через Google
      </button>

      <p className="text-center text-sm text-zinc-400 mt-6">
        Нет аккаунта?{" "}
        <Link
          href="/register"
          className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
        >
          Зарегистрироваться
        </Link>
      </p>

      <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition inline-flex items-center gap-1.5"
        >
          ← На главную
        </Link>
      </div>
    </div>
  );
}
