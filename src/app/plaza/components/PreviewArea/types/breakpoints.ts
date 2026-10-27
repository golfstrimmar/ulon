export type BreakpointId =
  | "full"
  | "2xl"
  | "xl"
  | "lg"
  | "md"
  | "sm"
  | "xs"
  | "xxs"
  | "custom";

export interface BreakpointItem {
  id: BreakpointId;
  name: string;
  label: string;
  width: number | "100%";
  icon: string;
  tooltip: string;
  mediaQuery: string;
  tailwindPrefix?: string;
  deviceType: string;
  // Альтернативная ширина при повороте (landscape/portrait)
  rotatedWidth?: number;
}

export const BREAKPOINTS: BreakpointItem[] = [
  {
    id: "full",
    name: "Full",
    label: "100%",
    width: "100%",
    icon: "↔️",
    tooltip: "Full width (100%) — резиновая ширина по экрану",
    mediaQuery: "Fluid (100%)",
    deviceType: "Резиновая ширина",
  },
  {
    id: "2xl",
    name: "2XL",
    label: "1536",
    width: 1536,
    icon: "🖥️",
    tooltip: "2XL Desktop — 1536px (большие мониторы)",
    mediaQuery: "min-width: 1536px",
    tailwindPrefix: "2xl:",
    deviceType: "Desktop HD",
  },
  {
    id: "xl",
    name: "XL",
    label: "1280",
    width: 1280,
    icon: "💻",
    tooltip: "XL Laptop — 1280px (десктопы и ноутбуки)",
    mediaQuery: "min-width: 1280px",
    tailwindPrefix: "xl:",
    deviceType: "Desktop / Laptop",
  },
  {
    id: "lg",
    name: "LG",
    label: "1024",
    width: 1024,
    icon: "💻",
    tooltip: "LG Laptop / Tablet Landscape — 1024px",
    mediaQuery: "min-width: 1024px",
    tailwindPrefix: "lg:",
    deviceType: "Laptop / Tablet",
    rotatedWidth: 768,
  },
  {
    id: "md",
    name: "MD",
    label: "768",
    width: 768,
    icon: "📟",
    tooltip: "MD Tablet Portrait — 768px (iPad, планшеты)",
    mediaQuery: "min-width: 768px",
    tailwindPrefix: "md:",
    deviceType: "Tablet",
    rotatedWidth: 1024,
  },
  {
    id: "sm",
    name: "SM",
    label: "640",
    width: 640,
    icon: "📱",
    tooltip: "SM Mobile Landscape — 640px",
    mediaQuery: "min-width: 640px",
    tailwindPrefix: "sm:",
    deviceType: "Mobile L",
    rotatedWidth: 375,
  },
  {
    id: "xs",
    name: "XS",
    label: "375",
    width: 375,
    icon: "📱",
    tooltip: "XS Mobile Portrait — 375px (iPhone, смартфоны)",
    mediaQuery: "max-width: 639px",
    tailwindPrefix: "base",
    deviceType: "Mobile",
    rotatedWidth: 667,
  },
  {
    id: "xxs",
    name: "320",
    label: "320",
    width: 320,
    icon: "📱",
    tooltip: "XXS Compact Mobile — 320px (iPhone SE, малые экраны)",
    mediaQuery: "max-width: 479px",
    tailwindPrefix: "base",
    deviceType: "Mobile S",
    rotatedWidth: 568,
  },
];
