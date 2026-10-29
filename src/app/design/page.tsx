import { DesignManager } from "@/app/design/components/DesignManager";

export const metadata = {
  title: "Design - tokens",
  description: "Figma design tokens extractor",
};

export default function Design() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <DesignManager />
    </main>
  );
}
