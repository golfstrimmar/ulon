"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { deleteAccountAction } from "@/actions/auth.actions";

export function DeleteAccountButton() {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? All your projects, folders, and data will be permanently deleted. This action cannot be undone.",
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const res = await deleteAccountAction();

      if (!res.success) {
        alert(res.error || "Failed to delete account");
        setLoading(false);
        return;
      }

      // Sign out and redirect to home page
      await signOut({ callbackUrl: "/" });
    } catch (err: any) {
      alert(err?.message || "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium text-red-400 bg-red-950/30 hover:bg-red-900/50 border border-red-800/60 hover:border-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {loading ? "Deleting account..." : "Delete account"}
    </button>
  );
}
