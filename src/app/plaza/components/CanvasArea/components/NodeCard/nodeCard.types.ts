import type { HtmlNode } from "@/types/HtmlNode";
export type { DropTarget } from "@/app/plaza/components/CanvasArea/hooks/useCanvasDnD";

export interface NodeCardProps {
  node: HtmlNode;
  depth: number;
  parentIsRow?: boolean;
}
