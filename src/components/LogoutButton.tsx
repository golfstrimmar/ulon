"use client";

import { signOut } from "next-auth/react";
import { modal } from "@/lib/modal";

export function LogoutButton() {
  const handleLogout = async () => {
    const ok = await modal.confirm(
      "Выход из системы",
      "Вы уверены, что хотите завершить текущую сессию?"
    );

    if (ok) {
      modal.info("Выход", "Завершаем сессию...", 1500);
      signOut({ callbackUrl: "/" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white transition cursor-pointer"
    >
      Выйти
    </button>
  );
}
