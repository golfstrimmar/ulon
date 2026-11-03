"use client";

import { useState, useMemo, useCallback } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  extractImagesFromJson,
  type FigmaImageItem,
} from "../models/figmaImageNode.model";
import { appendNodesToTree } from "../models/figmaTreeAppender";

export function useFigmaImagesController(rawJson: string) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const images: FigmaImageItem[] = useMemo(() => {
    return extractImagesFromJson(rawJson);
  }, [rawJson]);

  const saveImagesToTree = useCallback(async (nodes: HtmlNode[]) => {
    if (nodes.length === 0) return;
    try {
      await appendNodesToTree(nodes);
    } catch (err) {
      console.error(
        "[useFigmaImagesController] Failed to append nodes to tree:",
        err,
      );
    }
  }, []);

  return {
    images,
    imagesCount: images.length,
    hasImages: images.length > 0,
    isModalOpen,
    setIsModalOpen,
    saveImagesToTree,
  };
}
