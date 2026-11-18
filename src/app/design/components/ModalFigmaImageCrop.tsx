"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ButtonClose from "@/components/ButtonClose";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  createHtmlNodeFromImage,
  type FigmaBoundsMeta,
  type FigmaImageItem,
} from "../models/figmaImageNode.model";

interface ImageMetadata {
  format: string;
  bytes: number;
  sizeFormatted: string;
  dimensions: string;
  width: number;
  height: number;
}

interface ProcessedImageItem {
  id: string;
  name: string;
  originalBase64: string;
  originalMeta: ImageMetadata;
  croppedLosslessBase64?: string;
  activeBase64: string;
  activeMeta: ImageMetadata;
  selected: boolean;
  isCropped?: boolean;
  figmaMeta?: FigmaBoundsMeta;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type AspectPreset = "free" | "1:1" | "16:9" | "4:3";

interface ModalFigmaImageCropProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  rawImages: FigmaImageItem[];
  onSaveNodes: (nodes: HtmlNode[]) => Promise<void> | void;
}

const DEFAULT_CROP: CropBox = { x: 10, y: 10, width: 80, height: 80 };

const round1 = (v: number) => Math.round(v * 10) / 10;

function getNumericAspect(preset: AspectPreset): number | null {
  if (preset === "1:1") return 1;
  if (preset === "16:9") return 16 / 9;
  if (preset === "4:3") return 4 / 3;
  return null;
}

export default function ModalFigmaImageCrop({
  isOpen,
  setIsOpen,
  rawImages,
  onSaveNodes,
}: ModalFigmaImageCropProps) {
  const [imageItems, setImageItems] = useState<ProcessedImageItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [quality, setQuality] = useState<number>(0.85);
  const [outputFormat, setOutputFormat] = useState<string>("image/webp");

  const [crop, setCrop] = useState<CropBox>(DEFAULT_CROP);
  const [aspectRatio, setAspectRatio] = useState<AspectPreset>("free");
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imageItemsRef = useRef<ProcessedImageItem[]>([]);
  imageItemsRef.current = imageItems;

  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  const outputFormatRef = useRef(outputFormat);
  outputFormatRef.current = outputFormat;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getBase64Size = (base64: string): number => {
    const clean = base64.split(",")[1] || base64;
    return Math.round((clean.length * 3) / 4);
  };

  const compressSingleImage = useCallback(
    (
      srcBase64: string,
      targetQuality: number,
      mimeType: string,
    ): Promise<{ activeBase64: string; activeMeta: ImageMetadata }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, img.naturalWidth);
          canvas.height = Math.max(1, img.naturalHeight);
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            const fallbackBytes = getBase64Size(srcBase64);
            resolve({
              activeBase64: srcBase64,
              activeMeta: {
                format: "IMAGE",
                bytes: fallbackBytes,
                sizeFormatted: formatFileSize(fallbackBytes),
                dimensions: `${canvas.width} × ${canvas.height} px`,
                width: canvas.width,
                height: canvas.height,
              },
            });
            return;
          }

          if (mimeType === "image/jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          ctx.drawImage(img, 0, 0);

          const compressedDataUrl = canvas.toDataURL(mimeType, targetQuality);
          const bytes = getBase64Size(compressedDataUrl);
          const formatLabel = mimeType.replace("image/", "").toUpperCase();

          resolve({
            activeBase64: compressedDataUrl,
            activeMeta: {
              format: formatLabel,
              bytes,
              sizeFormatted: formatFileSize(bytes),
              dimensions: `${canvas.width} × ${canvas.height} px`,
              width: canvas.width,
              height: canvas.height,
            },
          });
        };
        img.onerror = () => {
          const fallbackBytes = getBase64Size(srcBase64);
          resolve({
            activeBase64: srcBase64,
            activeMeta: {
              format: "IMAGE",
              bytes: fallbackBytes,
              sizeFormatted: formatFileSize(fallbackBytes),
              dimensions: "0 × 0 px",
              width: 0,
              height: 0,
            },
          });
        };
        img.src = srcBase64;
      });
    },
    [],
  );

  // Загрузка rawImages при открытии
  useEffect(() => {
    if (!isOpen || rawImages.length === 0) {
      setImageItems([]);
      setActiveId(null);
      setCrop(DEFAULT_CROP);
      setAspectRatio("free");
      return;
    }

    let isMounted = true;

    const loadItems = async () => {
      const processed = await Promise.all(
        rawImages.map(async (raw) => {
          const rawBytes = getBase64Size(raw.data);
          const origMeta: ImageMetadata = {
            format: "ORIGINAL",
            bytes: rawBytes,
            sizeFormatted: formatFileSize(rawBytes),
            dimensions: `${raw.width} × ${raw.height} px`,
            width: raw.width,
            height: raw.height,
          };

          const { activeBase64, activeMeta } = await compressSingleImage(
            raw.data,
            qualityRef.current,
            outputFormatRef.current,
          );

          return {
            id:
              raw.id ||
              `figma_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: raw.name || "Figma Image",
            originalBase64: raw.data,
            originalMeta: origMeta,
            activeBase64,
            activeMeta,
            selected: true,
            isCropped: false,
            figmaMeta: {
              x: raw.x,
              y: raw.y,
              width: raw.width,
              height: raw.height,
              pageX: raw.pageX,
              pageY: raw.pageY,
              sectionId: raw.sectionId,
              sectionWidth: raw.sectionWidth,
              sectionHeight: raw.sectionHeight,
            },
          };
        }),
      );

      if (isMounted) {
        setImageItems(processed);
        setActiveId(processed[0]?.id ?? null);
        setCrop(DEFAULT_CROP);
        setAspectRatio("free");
      }
    };

    loadItems();

    return () => {
      isMounted = false;
    };
  }, [isOpen, rawImages, compressSingleImage]);

  // Пересжатие при изменении quality или outputFormat
  useEffect(() => {
    if (!isOpen || imageItemsRef.current.length === 0) return;

    let cancelled = false;

    const timeout = setTimeout(async () => {
      const snapshot = imageItemsRef.current;
      if (snapshot.length === 0 || cancelled) return;

      setIsCompressing(true);
      try {
        const results = await Promise.all(
          snapshot.map(async (item) => {
            const source =
              item.isCropped && item.croppedLosslessBase64
                ? item.croppedLosslessBase64
                : item.originalBase64;
            const { activeBase64, activeMeta } = await compressSingleImage(
              source,
              quality,
              outputFormat,
            );
            return { id: item.id, activeBase64, activeMeta };
          }),
        );

        if (cancelled) return;

        const byId = new Map(results.map((r) => [r.id, r]));
        setImageItems((prev) =>
          prev.map((curr) => {
            const updated = byId.get(curr.id);
            if (!updated) return curr;
            return {
              ...curr,
              activeBase64: updated.activeBase64,
              activeMeta: updated.activeMeta,
            };
          }),
        );
      } finally {
        if (!cancelled) {
          setIsCompressing(false);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, quality, outputFormat, compressSingleImage]);

  const activeItem =
    imageItems.find((it) => it.id === activeId) || imageItems[0] || null;

  const selectActiveItem = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setAspectRatio("free");
    setCrop(DEFAULT_CROP);
  };

  const toggleItemSelect = (id: string) => {
    setImageItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const applyCrop = () => {
    if (!activeItem) return;

    const targetId = activeItem.id;
    const currentCrop = { ...crop };
    const currentQuality = quality;
    const currentFormat = outputFormat;

    const img = new Image();
    img.onload = () => {
      const pixelX = Math.max(
        0,
        Math.round((currentCrop.x / 100) * img.naturalWidth),
      );
      const pixelY = Math.max(
        0,
        Math.round((currentCrop.y / 100) * img.naturalHeight),
      );
      const pixelW = Math.max(
        1,
        Math.min(
          img.naturalWidth - pixelX,
          Math.round((currentCrop.width / 100) * img.naturalWidth),
        ),
      );
      const pixelH = Math.max(
        1,
        Math.min(
          img.naturalHeight - pixelY,
          Math.round((currentCrop.height / 100) * img.naturalHeight),
        ),
      );

      const canvas = document.createElement("canvas");
      canvas.width = pixelW;
      canvas.height = pixelH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);
      const croppedLosslessBase64 = canvas.toDataURL("image/png");

      if (currentFormat === "image/jpeg") {
        const jpegCanvas = document.createElement("canvas");
        jpegCanvas.width = pixelW;
        jpegCanvas.height = pixelH;
        const jCtx = jpegCanvas.getContext("2d");
        if (jCtx) {
          jCtx.fillStyle = "#ffffff";
          jCtx.fillRect(0, 0, pixelW, pixelH);
          jCtx.drawImage(canvas, 0, 0);
          const croppedBase64 = jpegCanvas.toDataURL(
            currentFormat,
            currentQuality,
          );
          const bytes = getBase64Size(croppedBase64);
          const formatLabel = currentFormat.replace("image/", "").toUpperCase();

          setImageItems((prev) =>
            prev.map((it) =>
              it.id === targetId
                ? {
                    ...it,
                    croppedLosslessBase64,
                    activeBase64: croppedBase64,
                    activeMeta: {
                      format: formatLabel,
                      bytes,
                      sizeFormatted: formatFileSize(bytes),
                      dimensions: `${pixelW} × ${pixelH} px`,
                      width: pixelW,
                      height: pixelH,
                    },
                    isCropped: true,
                  }
                : it,
            ),
          );
          return;
        }
      }

      const croppedBase64 = canvas.toDataURL(currentFormat, currentQuality);
      const bytes = getBase64Size(croppedBase64);
      const formatLabel = currentFormat.replace("image/", "").toUpperCase();

      setImageItems((prev) =>
        prev.map((it) =>
          it.id === targetId
            ? {
                ...it,
                croppedLosslessBase64,
                activeBase64: croppedBase64,
                activeMeta: {
                  format: formatLabel,
                  bytes,
                  sizeFormatted: formatFileSize(bytes),
                  dimensions: `${pixelW} × ${pixelH} px`,
                  width: pixelW,
                  height: pixelH,
                },
                isCropped: true,
              }
            : it,
        ),
      );
    };
    img.onerror = () => {
      console.error("Failed to load original image for cropping.");
    };
    img.src = activeItem.originalBase64;
  };

  const resetCropToOriginal = async () => {
    if (!activeItem) return;
    const targetId = activeItem.id;
    const { activeBase64, activeMeta } = await compressSingleImage(
      activeItem.originalBase64,
      quality,
      outputFormat,
    );
    setImageItems((prev) =>
      prev.map((it) =>
        it.id === targetId
          ? {
              ...it,
              croppedLosslessBase64: undefined,
              activeBase64,
              activeMeta,
              isCropped: false,
            }
          : it,
      ),
    );
    setAspectRatio("free");
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
  };

  const setCropPreset = (ratio: AspectPreset) => {
    setAspectRatio(ratio);
    const targetAspect = getNumericAspect(ratio);
    if (!targetAspect) {
      setCrop(DEFAULT_CROP);
      return;
    }

    const origW = activeItem?.originalMeta.width || 1;
    const origH = activeItem?.originalMeta.height || 1;
    const imgAspect = origW / Math.max(1, origH);

    let widthPct = 80;
    let heightPct = (widthPct * imgAspect) / targetAspect;

    if (heightPct > 80) {
      heightPct = 80;
      widthPct = (heightPct * targetAspect) / imgAspect;
    }

    widthPct = Math.max(10, Math.min(100, round1(widthPct)));
    heightPct = Math.max(10, Math.min(100, round1(heightPct)));

    setCrop({
      x: round1((100 - widthPct) / 2),
      y: round1((100 - heightPct) / 2),
      width: widthPct,
      height: heightPct,
    });
  };

  const handleCropDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = previewContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialCrop = { ...crop };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const dx = ((moveEvt.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvt.clientY - startY) / rect.height) * 100;

      const nextX = Math.max(
        0,
        Math.min(100 - initialCrop.width, initialCrop.x + dx),
      );
      const nextY = Math.max(
        0,
        Math.min(100 - initialCrop.height, initialCrop.y + dy),
      );

      setCrop({
        ...initialCrop,
        x: round1(nextX),
        y: round1(nextY),
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleResizeHandle = (
    handle: "nw" | "ne" | "sw" | "se",
    e: React.PointerEvent,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const container = previewContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const init = { ...crop };
    const targetAspect = getNumericAspect(aspectRatio);
    const imgAspect =
      (activeItem?.originalMeta.width || rect.width) /
      Math.max(1, activeItem?.originalMeta.height || rect.height);

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const dx = ((moveEvt.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvt.clientY - startY) / rect.height) * 100;
      let { x, y, width, height } = init;

      if (targetAspect) {
        const pctRatio = imgAspect / targetAspect;
        const minW = Math.max(10, 10 / pctRatio);

        if (handle === "se") {
          const maxW = Math.min(100 - init.x, (100 - init.y) / pctRatio);
          width = Math.max(minW, Math.min(maxW, init.width + dx));
          height = width * pctRatio;
        } else if (handle === "sw") {
          const right = init.x + init.width;
          const maxW = Math.min(right, (100 - init.y) / pctRatio);
          width = Math.max(minW, Math.min(maxW, init.width - dx));
          height = width * pctRatio;
          x = right - width;
        } else if (handle === "ne") {
          const bottom = init.y + init.height;
          const maxW = Math.min(100 - init.x, bottom / pctRatio);
          width = Math.max(minW, Math.min(maxW, init.width + dx));
          height = width * pctRatio;
          y = bottom - height;
        } else if (handle === "nw") {
          const right = init.x + init.width;
          const bottom = init.y + init.height;
          const maxW = Math.min(right, bottom / pctRatio);
          width = Math.max(minW, Math.min(maxW, init.width - dx));
          height = width * pctRatio;
          x = right - width;
          y = bottom - height;
        }
      } else {
        if (handle === "se") {
          width = Math.max(10, Math.min(100 - x, init.width + dx));
          height = Math.max(10, Math.min(100 - y, init.height + dy));
        } else if (handle === "sw") {
          const nextX = Math.max(
            0,
            Math.min(init.x + init.width - 10, init.x + dx),
          );
          width = init.width - (nextX - init.x);
          x = nextX;
          height = Math.max(10, Math.min(100 - y, init.height + dy));
        } else if (handle === "ne") {
          const nextY = Math.max(
            0,
            Math.min(init.y + init.height - 10, init.y + dy),
          );
          height = init.height - (nextY - init.y);
          y = nextY;
          width = Math.max(10, Math.min(100 - x, init.width + dx));
        } else if (handle === "nw") {
          const nextX = Math.max(
            0,
            Math.min(init.x + init.width - 10, init.x + dx),
          );
          const nextY = Math.max(
            0,
            Math.min(init.y + init.height - 10, init.y + dy),
          );
          width = init.width - (nextX - init.x);
          height = init.height - (nextY - init.y);
          x = nextX;
          y = nextY;
        }
      }

      setCrop({
        x: round1(x),
        y: round1(y),
        width: round1(width),
        height: round1(height),
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleSaveToTree = async () => {
    const selected = imageItems.filter((i) => i.selected);
    if (selected.length === 0) return;

    setIsSaving(true);
    try {
      const generatedNodes: HtmlNode[] = selected.map((item) => {
        const syncedMeta =
          item.figmaMeta && item.isCropped
            ? {
                ...item.figmaMeta,
                width: item.activeMeta.width,
                height: item.activeMeta.height,
              }
            : item.figmaMeta;

        return createHtmlNodeFromImage({
          name: item.name,
          activeBase64: item.activeBase64,
          width: item.activeMeta.width,
          height: item.activeMeta.height,
          figmaMeta: syncedMeta,
        });
      });

      await onSaveNodes(generatedNodes);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to append image nodes:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedItems = imageItems.filter((i) => i.selected);
  const totalOriginalBytes = selectedItems.reduce(
    (sum, i) => sum + i.originalMeta.bytes,
    0,
  );
  const totalActiveBytes = selectedItems.reduce(
    (sum, i) => sum + i.activeMeta.bytes,
    0,
  );
  const totalSavedPercent =
    totalOriginalBytes > 0
      ? Math.round(
          ((totalOriginalBytes - totalActiveBytes) / totalOriginalBytes) * 100,
        )
      : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 w-screen h-screen bg-black/98 z-50 overflow-hidden flex flex-col justify-between p-4 sm:p-6"
        >
          {/* Header */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-neutral-100 tracking-wide flex items-center gap-2">
                <span>Figma Extracted Images</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/50 text-xs font-mono">
                  {imageItems.length} found
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Crop & optimize images from current Figma JSON, then append as
                image blocks
              </p>
            </div>
            <ButtonClose setClose={setIsOpen} />
          </div>

          {/* Master-Detail Crop Workspace */}
          <div className="w-full flex-1 my-3 flex flex-col lg:flex-row gap-4 overflow-hidden">
            {/* LEFT: Preview & Crop Area */}
            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
              <div className="h-10 px-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-zinc-400">Aspect:</span>
                  {(["free", "1:1", "16:9", "4:3"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCropPreset(r)}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] border transition ${
                        aspectRatio === r
                          ? "bg-blue-600 border-blue-400 text-white font-bold"
                          : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {activeItem?.isCropped && (
                    <button
                      type="button"
                      onClick={resetCropToOriginal}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 text-xs font-mono transition"
                    >
                      Reset Crop
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={applyCrop}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs transition shadow-md active:scale-95"
                  >
                    ✂️ Apply Crop
                  </button>
                </div>
              </div>

              <div className="flex-1 p-4 flex items-center justify-center overflow-hidden bg-zinc-950/60 select-none">
                {activeItem && (
                  <div
                    ref={previewContainerRef}
                    className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden rounded-lg shadow-xl border border-zinc-800"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeItem.originalBase64}
                      alt="Crop target"
                      className="max-h-[52vh] max-w-full object-contain pointer-events-none block"
                    />

                    {/* Crop Overlay */}
                    <div
                      onPointerDown={handleCropDrag}
                      className="absolute border-2 border-blue-400 bg-blue-500/10 cursor-move touch-none"
                      style={{
                        left: `${crop.x}%`,
                        top: `${crop.y}%`,
                        width: `${crop.width}%`,
                        height: `${crop.height}%`,
                        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                      }}
                    >
                      <div
                        onPointerDown={(e) => handleResizeHandle("nw", e)}
                        className="absolute -top-1.5 -left-1.5 size-3.5 bg-white border-2 border-blue-600 rounded-sm cursor-nwse-resize shadow touch-none"
                      />
                      <div
                        onPointerDown={(e) => handleResizeHandle("ne", e)}
                        className="absolute -top-1.5 -right-1.5 size-3.5 bg-white border-2 border-blue-600 rounded-sm cursor-nesw-resize shadow touch-none"
                      />
                      <div
                        onPointerDown={(e) => handleResizeHandle("sw", e)}
                        className="absolute -bottom-1.5 -left-1.5 size-3.5 bg-white border-2 border-blue-600 rounded-sm cursor-nesw-resize shadow touch-none"
                      />
                      <div
                        onPointerDown={(e) => handleResizeHandle("se", e)}
                        className="absolute -bottom-1.5 -right-1.5 size-3.5 bg-white border-2 border-blue-600 rounded-sm cursor-nwse-resize shadow touch-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {activeItem && (
                <div className="px-4 py-2 bg-zinc-900/80 border-t border-zinc-800 text-xs font-mono flex items-center justify-between text-zinc-400">
                  <span className="truncate max-w-[280px]">
                    {activeItem.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span>{activeItem.activeMeta.dimensions}</span>
                    <span className="text-emerald-400 font-bold">
                      {activeItem.activeMeta.sizeFormatted}
                    </span>
                    {activeItem.isCropped && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                        Cropped
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Images Queue & Compression Settings */}
            <div className="w-full lg:w-96 flex flex-col gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-hidden">
              <span className="text-xs font-bold text-zinc-300 border-b border-zinc-800 pb-2">
                Figma Images ({imageItems.length})
              </span>

              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1 min-h-[160px]">
                {imageItems.map((item) => {
                  const isCurrent = item.id === (activeItem?.id || "");
                  return (
                    <div
                      key={item.id}
                      onClick={() => selectActiveItem(item.id)}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                        isCurrent
                          ? "bg-zinc-800/90 border-blue-500 shadow-md ring-1 ring-blue-500/40"
                          : "bg-zinc-950/50 border-zinc-800 hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleItemSelect(item.id);
                          }}
                          className="rounded border-zinc-700 bg-zinc-800 text-blue-600 accent-blue-500 cursor-pointer"
                        />
                        <div className="size-10 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.activeBase64}
                            alt={item.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-zinc-200 font-medium truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {item.activeMeta.sizeFormatted} •{" "}
                            {item.activeMeta.dimensions}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compression Config */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400">
                    Format:
                  </span>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="bg-zinc-900 text-zinc-200 border border-zinc-700 rounded px-2 py-0.5 text-xs outline-none cursor-pointer focus:border-blue-500 font-mono"
                  >
                    <option value="image/webp">WEBP (Recommended)</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG (Lossless)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Quality:</span>
                    <span className="font-mono text-blue-400 font-bold">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={quality}
                    disabled={outputFormat === "image/png"}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
                  />
                </div>
              </div>

              {selectedItems.length > 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-400">Total size:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">
                      {formatFileSize(totalActiveBytes)}
                    </span>
                    {totalSavedPercent > 0 && (
                      <span className="text-[10px] text-emerald-500 font-bold">
                        (-{totalSavedPercent}%)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="w-full flex items-center justify-between pt-3 border-t border-zinc-800">
            <span className="text-xs text-zinc-500 font-mono">
              {selectedItems.length > 0
                ? `Ready to insert: ${selectedItems.length} image node(s)`
                : "No images selected"}
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  selectedItems.length === 0 || isCompressing || isSaving
                }
                onClick={handleSaveToTree}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition shadow-lg cursor-pointer ${
                  selectedItems.length > 0 && !isCompressing && !isSaving
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                }`}
              >
                {isSaving
                  ? "Saving to Tree..."
                  : isCompressing
                    ? "Optimizing..."
                    : `Save ${selectedItems.length > 0 ? `(${selectedItems.length})` : ""} to Canvas`}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
