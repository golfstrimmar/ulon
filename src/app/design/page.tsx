import { DesignManager } from "@/app/design/components/DesignManager";
import { Suspense } from "react";
export const metadata = {
  title: "Design - tokens",
  description: "Figma design tokens extractor",
};

export default function Design() {
  return (
    <section className="Design">
      <Suspense fallback={<div className="text-zinc-400">Loading...</div>}>
        <DesignManager />
      </Suspense>
    </section>
  );
}
