import type { ExportTab } from "../models/types";

export const TABS: ExportTab[] = [
  { id: "preview", label: "👁 Preview" },
  {
    id: "html",
    label: "🌐 index.html",
    filename: "index.html",
    color: "orange",
  },
  {
    id: "css",
    label: "🎨 styles.css",
    filename: "styles.css",
    color: "sky",
  },
  {
    id: "js",
    label: "⚡ scripts.js",
    filename: "scripts.js",
    color: "amber",
  },
];
