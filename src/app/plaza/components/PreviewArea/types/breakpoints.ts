export type BreakpointId =
  "full" | "2xl" | "xl" | "lg" | "md" | "sm" | "xs" | "xxs" | "custom";

export interface BreakpointItem {
  id: BreakpointId;
  name: string;
  label: string;
  segment: string;
  width: number | "100%";
  icon: string;
  tooltip: string;
  mediaQuery: string;
  tailwindPrefix?: string;
  deviceType: string;
  rotatedWidth?: number;
}

/**
 * 🔹 Breakpoints strictly aligned with corridors from QUICK_BREAKPOINTS:
 * 2xl: ≥ 1536px          => preview width: 1536px
 * xl:  1280px – 1535px   => preview width: 1366px (laptops, solidly inside corridor)
 * lg:  1024px – 1279px   => preview width: 1152px (tablets landscape, inside corridor)
 * md:  768px – 1023px    => preview width: 834px  (tablets portrait, inside corridor)
 * sm:  640px – 767px     => preview width: 667px  (smartphones landscape, inside corridor)
 * xs:  480px – 639px     => preview width: 540px  (smartphones, inside corridor)
 * xxs: ≤ 479px           => preview width: 375px  (compact mobile, inside corridor)
 */
export const BREAKPOINTS: BreakpointItem[] = [
  {
    id: "full",
    name: "Full",
    label: "100%",
    segment: "100%",
    width: "100%",
    icon: "↔️",
    tooltip: "Full width (100%) — fluid responsive screen",
    mediaQuery: "Fluid (100%)",
    deviceType: "Fluid",
  },
  {
    id: "2xl",
    name: "2XL",
    label: "≥1536px",
    segment: "≥1536px",
    width: 1536,
    icon: "🖥️",
    tooltip: "Отрезок 2XL: от 1536px и выше (большие мониторы)",
    mediaQuery: "(min-width: 1536px)",
    tailwindPrefix: "2xl:",
    deviceType: "Desktop HD",
  },
  {
    id: "xl",
    name: "XL",
    label: "1280–1535px",
    segment: "1280–1535px",
    width: 1366,
    icon: "💻",
    tooltip: "Отрезок XL: от 1280px до 1535px (ноутбуки и десктопы)",
    mediaQuery: "(min-width: 1280px) and (max-width: 1535px)",
    tailwindPrefix: "xl:",
    deviceType: "Desktop / Laptop",
  },
  {
    id: "lg",
    name: "LG",
    label: "1024–1279px",
    segment: "1024–1279px",
    width: 1152,
    icon: "💻",
    tooltip: "Отрезок LG: от 1024px до 1279px (ультрабуки / планшеты ландшафт)",
    mediaQuery: "(min-width: 1024px) and (max-width: 1279px)",
    tailwindPrefix: "lg:",
    deviceType: "Laptop / Tablet",
    rotatedWidth: 768,
  },
  {
    id: "md",
    name: "MD",
    label: "768–1023px",
    segment: "768–1023px",
    width: 834,
    icon: "📟",
    tooltip: "Отрезок MD: от 768px до 1023px (планшеты портрет)",
    mediaQuery: "(min-width: 768px) and (max-width: 1023px)",
    tailwindPrefix: "md:",
    deviceType: "Tablet",
    rotatedWidth: 1024,
  },
  {
    id: "sm",
    name: "SM",
    label: "640–767px",
    segment: "640–767px",
    width: 667,
    icon: "📱",
    tooltip: "Отрезок SM: от 640px до 767px (большие смартфоны ландшафт)",
    mediaQuery: "(min-width: 640px) and (max-width: 767px)",
    tailwindPrefix: "sm:",
    deviceType: "Mobile L",
    rotatedWidth: 375,
  },
  {
    id: "xs",
    name: "XS",
    label: "480–639px",
    segment: "480–639px",
    width: 540,
    icon: "📱",
    tooltip: "Отрезок XS: от 480px до 639px (смартфоны портрет)",
    mediaQuery: "(min-width: 480px) and (max-width: 639px)",
    tailwindPrefix: "base",
    deviceType: "Mobile",
    rotatedWidth: 640,
  },
  {
    id: "xxs",
    name: "XXS",
    label: "≤479px",
    segment: "≤479px",
    width: 375,
    icon: "📱",
    tooltip: "Отрезок XXS: от 0 до 479px (малые экраны / iPhone SE)",
    mediaQuery: "(max-width: 479px)",
    tailwindPrefix: "base",
    deviceType: "Mobile S",
    rotatedWidth: 480,
  },
];
