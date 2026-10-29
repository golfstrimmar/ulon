import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <section className="flex-1 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-zinc-400">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
