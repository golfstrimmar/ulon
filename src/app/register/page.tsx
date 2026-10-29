import { RegisterForm } from "./RegisterForm";
import { Suspense } from "react";
export default function RegisterPage() {
  return (
    <section className="flex-1 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-zinc-400">Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </section>
  );
}
