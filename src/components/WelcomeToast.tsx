"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { modal } from "@/lib/modal";

export function WelcomeToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const welcome = searchParams.get("welcome");

  useEffect(() => {
    if (welcome) {
      modal.success("Signed in successfully!", "Welcome back.", 2000);
      router.replace("/");
    }
  }, [welcome, router]);

  return null;
}
