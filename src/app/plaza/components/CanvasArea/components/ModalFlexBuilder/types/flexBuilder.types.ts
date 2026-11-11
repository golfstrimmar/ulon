import type { HtmlNode } from "@/types/HtmlNode";

export type FlexDirection = "row" | "col";

export interface ModalFlexBuilderProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialDirection?: FlexDirection;
  onSaveNode?: (node: HtmlNode) => void;
}

export interface SplitterPosition {
  index: number;
  position: number;
}
