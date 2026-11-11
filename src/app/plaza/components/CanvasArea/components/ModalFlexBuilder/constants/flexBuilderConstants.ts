export const MIN_ITEMS_COUNT = 1;
export const MAX_ITEMS_COUNT = 12;
export const DEFAULT_ITEMS_COUNT = 3;
export const MIN_ITEM_PERCENT = 4;

export const DEFAULT_ROW_CLASS = "f-r";
export const DEFAULT_COL_CLASS = "f-c";

export const INITIAL_PERCENTAGES = [33.33, 33.34, 33.33];

export interface QuickPreset {
  label: string;
  percentages: number[];
}

export const QUICK_PRESETS: QuickPreset[] = [
  { label: "50% / 50%", percentages: [50, 50] },
  { label: "3 × 33.33%", percentages: [33.33, 33.34, 33.33] },
  { label: "25% / 50% / 25%", percentages: [25, 50, 25] },
  { label: "30% / 70%", percentages: [30, 70] },
  { label: "70% / 30%", percentages: [70, 30] },
  { label: "4 × 25%", percentages: [25, 25, 25, 25] },
];

export interface ColumnColor {
  bg: string;
  border: string;
  text: string;
}

export const COLUMN_COLORS: ColumnColor[] = [
  {
    bg: "bg-blue-500/15",
    border: "border-blue-500/40",
    text: "text-blue-400",
  },
  {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-400",
  },
  {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-400",
  },
  {
    bg: "bg-purple-500/15",
    border: "border-purple-500/40",
    text: "text-purple-400",
  },
  {
    bg: "bg-pink-500/15",
    border: "border-pink-500/40",
    text: "text-pink-400",
  },
  {
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/40",
    text: "text-cyan-400",
  },
  {
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    text: "text-rose-400",
  },
  {
    bg: "bg-teal-500/15",
    border: "border-teal-500/40",
    text: "text-teal-400",
  },
  {
    bg: "bg-orange-500/15",
    border: "border-orange-500/40",
    text: "text-orange-400",
  },
  {
    bg: "bg-indigo-500/15",
    border: "border-indigo-500/40",
    text: "text-indigo-400",
  },
  {
    bg: "bg-lime-500/15",
    border: "border-lime-500/40",
    text: "text-lime-400",
  },
  {
    bg: "bg-violet-500/15",
    border: "border-violet-500/40",
    text: "text-violet-400",
  },
];
