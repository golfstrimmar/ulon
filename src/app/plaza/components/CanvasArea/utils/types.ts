/**
 * @file types.ts
 * @description Типы для рендеринга дерева узлов HtmlNode на Canvas.
 */

export interface RenderBox {
  key: string;
  tag: string;
  class?: string;
  text?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  hasChildren: boolean;
  isCollapsed?: boolean;
  toggleBtnBounds?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}
