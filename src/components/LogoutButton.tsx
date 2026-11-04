"use client";

import { useState } from "react";
import { logoutUserAction } from "@/actions/auth.actions";
import { modal } from "@/lib/modal";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    const ok = await modal?.confirm?.(
      "Sign out",
      "Are you sure you want to end your current session?",
    );

    if (!ok) return;

    setLoading(true);

    try {
      modal?.info?.("Signing out", "Ending your session...", 1500);
      // 🚀 Direct call to Server Action
      await logoutUserAction();
    } catch (err: any) {
      console.error("Logout error:", err);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
