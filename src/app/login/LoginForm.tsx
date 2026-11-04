"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginUserAction } from "@/actions/auth.actions";
import { modal } from "@/lib/modal";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const urlError = searchParams.get("error");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState<string | null>(
    urlError === "OAuthAccountNotLinked"
      ? "This email is already registered with a password. Try signing in with Google again to link your accounts."
      : urlError
        ? "Authorization error: " + urlError
        : null,
  );

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (urlError === "OAuthAccountNotLinked") {
      modal?.warning?.(
        "Account already exists",
        "This email is already registered with a password. Sign in with Google again and your accounts will be linked automatically.",
      );
    } else if (urlError) {
      modal?.error?.("Authorization error", `Error code: ${urlError}`);
    } else if (registered) {
      modal?.success?.(
        "Registration successful!",
        "Your account has been created. Sign in with your email and password.",
      );
    }
  }, [urlError, registered]);

  // Submit via Server Action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 🚀 Call Server Action
      const result = await loginUserAction(formData);

      if (!result.success) {
        const msg = result.error || "Invalid email or password";
        setError(msg);
        await modal?.error?.("Sign in error", msg, 2000);
        return;
      }

      router.push("/?welcome=1");
      router.refresh();
    } catch (err: any) {
      const msg = "Sign in failed. Please try again.";
      setError(msg);
      await modal?.error?.("Server error", msg, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      await modal?.info?.("Google sign in", "Redirecting to Google...", 1500);
      await signIn("google", { callbackUrl: "/?welcome=1" });
    } catch (err: any) {
      setError("Failed to sign in with Google");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Sign in
        </h1>
        <p className="text-sm text-zinc-400 mt-2">
          Enter your credentials to continue
        </p>
      </div>

      {registered && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-sm">
          Account created! Sign in with your email and password.
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-800 border border-zinc-700 text-zinc-200 font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        {googleLoading ? "Connecting to Google..." : "Continue with Google"}
      </button>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-zinc-900 px-3 text-zinc-500 font-medium">
            or continue with email
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="example@mail.com"
            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-zinc-400 mt-6">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
        >
          Register
        </Link>
      </p>

      <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition inline-flex items-center gap-1.5"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
