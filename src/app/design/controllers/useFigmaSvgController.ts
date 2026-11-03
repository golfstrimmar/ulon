"use client";

import { useState, useMemo, useCallback } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  extractSvgsFromJson,
  type FigmaSvgItem,
} from "../models/figmaSvgNode.model";
import { appendNodesToTree } from "../models/figmaTreeAppender";

export function useFigmaSvgController(rawJson: string) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const svgs: FigmaSvgItem[] = useMemo(() => {
    return extractSvgsFromJson(rawJson);
  }, [rawJson]);

  const saveSvgsToTree = useCallback(async (nodes: HtmlNode[]) => {
    if (nodes.length === 0) return;
    try {
      await appendNodesToTree(nodes);
    } catch (err) {
      console.error(
        "[useFigmaSvgController] Failed to append SVG nodes to tree:",
        err,
      );
    }
  }, []);

  return {
    svgs,
    svgsCount: svgs.length,
    hasSvgs: svgs.length > 0,
    isModalOpen,
    setIsModalOpen,
    saveSvgsToTree,
  };
}
