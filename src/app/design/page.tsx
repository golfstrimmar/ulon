import { FigmaColorsViewer } from "@/app/design/components/FigmaColorsViewer";

export const metadata = {
  title: "Design - tokens",
  description: "Figma design tokens extractor",
};

//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function Design() {
  return <FigmaColorsViewer />;
}
