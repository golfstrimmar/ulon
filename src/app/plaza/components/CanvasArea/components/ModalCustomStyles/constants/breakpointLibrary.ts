import {
  BREAKPOINTS,
  type BreakpointItem,
} from "@/app/plaza/components/PreviewArea/types/breakpoints";

export type BreakpointCategory =
  | "corridors"
  | "max_width"
  | "min_width"
  | "orientation";

export interface BreakpointMediaItem {
  selector: string;
  label: string;
  segment: string;
  category: BreakpointCategory;
  description: string;
  icon?: string;
}

/**
 * Основные отрезки (диапазоны), построенные строго по границам из breakpoints.ts:
 * 2xl: 1536px  => отрезок ≥ 1536px
 * xl:  1280px  => отрезок 1280px – 1535px
 * lg:  1024px  => отрезок 1024px – 1279px
 * md:  768px   => отрезок 768px – 1023px
 * sm:  640px   => отрезок 640px – 767px
 * xs:  480px   => отрезок 480px – 639px (в breakpoints.ts xs=375, max-width: 639px)
 * xxs: 320px   => отрезок ≤ 479px (в breakpoints.ts xxs=320, max-width: 479px)
 */
export const QUICK_BREAKPOINTS = [
  {
    id: "2xl",
    label: "2XL",
    segment: "≥1536px",
    title: "Отрезок 2XL: от 1536px и выше (большие мониторы)",
    mediaQuery: "@media (min-width: 1536px)",
  },
  {
    id: "xl",
    label: "XL",
    segment: "1280–1535px",
    title: "Отрезок XL: от 1280px до 1535px (ноутбуки и десктопы)",
    mediaQuery: "@media (min-width: 1280px) and (max-width: 1535px)",
  },
  {
    id: "lg",
    label: "LG",
    segment: "1024–1279px",
    title: "Отрезок LG: от 1024px до 1279px (ультрабуки / планшеты ландшафт)",
    mediaQuery: "@media (min-width: 1024px) and (max-width: 1279px)",
  },
  {
    id: "md",
    label: "MD",
    segment: "768–1023px",
    title: "Отрезок MD: от 768px до 1023px (планшеты портрет)",
    mediaQuery: "@media (min-width: 768px) and (max-width: 1023px)",
  },
  {
    id: "sm",
    label: "SM",
    segment: "640–767px",
    title: "Отрезок SM: от 640px до 767px (большие смартфоны ландшафт)",
    mediaQuery: "@media (min-width: 640px) and (max-width: 767px)",
  },
  {
    id: "xs",
    label: "XS",
    segment: "480–639px",
    title: "Отрезок XS: от 480px до 639px (смартфоны портрет)",
    mediaQuery: "@media (min-width: 480px) and (max-width: 639px)",
  },
  {
    id: "xxs",
    label: "XXS",
    segment: "≤479px",
    title: "Отрезок XXS: от 0 до 479px (малые экраны / iPhone SE)",
    mediaQuery: "@media (max-width: 479px)",
  },
] as const;

export const BREAKPOINT_CATEGORY_LABELS: Record<BreakpointCategory, string> = {
  corridors: "Отрезки экранов (Диапазоны)",
  max_width: "Desktop-first (max-width)",
  min_width: "Mobile-first (min-width)",
  orientation: "Ориентация экрана",
};

export const BREAKPOINT_LIBRARY: BreakpointMediaItem[] = [
  // ─── 1. ОТРЕЗКИ (ДИАПАЗОНЫ) ────────────────────────────────────────────────
  {
    selector: "@media (min-width: 1536px)",
    label: "2XL",
    segment: "≥ 1536px",
    category: "corridors",
    description: "Desktop HD, большие мониторы",
    icon: "🖥️",
  },
  {
    selector: "@media (min-width: 1280px) and (max-width: 1535px)",
    label: "XL",
    segment: "1280px – 1535px",
    category: "corridors",
    description: "Десктопы и ноутбуки",
    icon: "💻",
  },
  {
    selector: "@media (min-width: 1024px) and (max-width: 1279px)",
    label: "LG",
    segment: "1024px – 1279px",
    category: "corridors",
    description: "Ультрабуки, планшеты ландшафт",
    icon: "💻",
  },
  {
    selector: "@media (min-width: 768px) and (max-width: 1023px)",
    label: "MD",
    segment: "768px – 1023px",
    category: "corridors",
    description: "Планшеты портрет (iPad)",
    icon: "📟",
  },
  {
    selector: "@media (min-width: 640px) and (max-width: 767px)",
    label: "SM",
    segment: "640px – 767px",
    category: "corridors",
    description: "Смартфоны ландшафт",
    icon: "📱",
  },
  {
    selector: "@media (min-width: 480px) and (max-width: 639px)",
    label: "XS",
    segment: "480px – 639px",
    category: "corridors",
    description: "Смартфоны стандартные",
    icon: "📱",
  },
  {
    selector: "@media (max-width: 479px)",
    label: "XXS",
    segment: "≤ 479px",
    category: "corridors",
    description: "Компактные смартфоны",
    icon: "📱",
  },

  // ─── 2. DESKTOP-FIRST (MAX-WIDTH) ─────────────────────────────────────────
  {
    selector: "@media (max-width: 1535px)",
    label: "max-width: 1535px",
    segment: "≤ 1535px",
    category: "max_width",
    description: "Меньше 2XL (≤ 1535px)",
  },
  {
    selector: "@media (max-width: 1279px)",
    label: "max-width: 1279px",
    segment: "≤ 1279px",
    category: "max_width",
    description: "Меньше XL (≤ 1279px)",
  },
  {
    selector: "@media (max-width: 1023px)",
    label: "max-width: 1023px",
    segment: "≤ 1023px",
    category: "max_width",
    description: "Меньше LG (≤ 1023px)",
  },
  {
    selector: "@media (max-width: 767px)",
    label: "max-width: 767px",
    segment: "≤ 767px",
    category: "max_width",
    description: "Меньше MD (≤ 767px)",
  },
  {
    selector: "@media (max-width: 639px)",
    label: "max-width: 639px",
    segment: "≤ 639px",
    category: "max_width",
    description: "Меньше SM (≤ 639px)",
  },
  {
    selector: "@media (max-width: 479px)",
    label: "max-width: 479px",
    segment: "≤ 479px",
    category: "max_width",
    description: "Меньше XS (≤ 479px)",
  },

  // ─── 3. MOBILE-FIRST (MIN-WIDTH) ──────────────────────────────────────────
  {
    selector: "@media (min-width: 480px)",
    label: "min-width: 480px",
    segment: "≥ 480px",
    category: "min_width",
    description: "От XS и выше (≥ 480px)",
  },
  {
    selector: "@media (min-width: 640px)",
    label: "min-width: 640px",
    segment: "≥ 640px",
    category: "min_width",
    description: "От SM и выше (≥ 640px)",
  },
  {
    selector: "@media (min-width: 768px)",
    label: "min-width: 768px",
    segment: "≥ 768px",
    category: "min_width",
    description: "От MD и выше (≥ 768px)",
  },
  {
    selector: "@media (min-width: 1024px)",
    label: "min-width: 1024px",
    segment: "≥ 1024px",
    category: "min_width",
    description: "От LG и выше (≥ 1024px)",
  },
  {
    selector: "@media (min-width: 1280px)",
    label: "min-width: 1280px",
    segment: "≥ 1280px",
    category: "min_width",
    description: "От XL и выше (≥ 1280px)",
  },
  {
    selector: "@media (min-width: 1536px)",
    label: "min-width: 1536px",
    segment: "≥ 1536px",
    category: "min_width",
    description: "От 2XL и выше (≥ 1536px)",
  },

  // ─── 4. ОРИЕНТАЦИЯ ────────────────────────────────────────────────────────
  {
    selector: "@media (orientation: landscape)",
    label: "orientation: landscape",
    segment: "landscape",
    category: "orientation",
    description: "Альбомная ориентация",
  },
  {
    selector: "@media (orientation: portrait)",
    label: "orientation: portrait",
    segment: "portrait",
    category: "orientation",
    description: "Портретная ориентация",
  },
];

/**
 * Возвращает читаемое обозначение отрезка (имя и диапазон) для медиа-запроса
 */
export function getSegmentDisplay(mediaQuery: string): {
  name?: string;
  segment: string;
} {
  const normalized = normalizeMediaQuery(mediaQuery);
  const foundQuick = QUICK_BREAKPOINTS.find(
    (bp) => normalizeMediaQuery(bp.mediaQuery) === normalized
  );
  if (foundQuick) {
    return { name: foundQuick.label, segment: foundQuick.segment };
  }

  // Парсим диапазон min-width и max-width
  const minMatch = normalized.match(/min-width:\s*(\d+)px/);
  const maxMatch = normalized.match(/max-width:\s*(\d+)px/);

  if (minMatch && maxMatch) {
    return { segment: `${minMatch[1]}–${maxMatch[1]}px` };
  }
  if (minMatch && !maxMatch) {
    return { segment: `≥${minMatch[1]}px` };
  }
  if (maxMatch && !minMatch) {
    return { segment: `≤${maxMatch[1]}px` };
  }

  return { segment: normalized.replace(/^@media\s*/, "") };
}

/**
 * Нормализует пробелы в строке медиа-запроса для надёжного сравнения
 */
export function normalizeMediaQuery(str: string): string {
  if (!str) return "";
  return str.trim().replace(/\s+/g, " ");
}

/**
 * Извлекает все @media селекторы, присутствующие в SCSS коде класса
 */
export function extractExistingMediaQueries(scssText: string): string[] {
  if (!scssText) return [];
  const found = new Set<string>();
  const regex = /(?:^|\n)\s*(@media[^{]+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(scssText)) !== null) {
    found.add(normalizeMediaQuery(match[1]));
  }
  return Array.from(found);
}

/**
 * Форматирует произвольный ввод пользователя в валидный @media (...) селектор
 */
export function formatMediaQueryInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("@media")) {
    return normalizeMediaQuery(trimmed);
  }

  if (trimmed.startsWith("(")) {
    return normalizeMediaQuery(`@media ${trimmed}`);
  }

  return normalizeMediaQuery(`@media (${trimmed})`);
}
