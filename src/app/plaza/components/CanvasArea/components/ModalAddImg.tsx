"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ButtonClose from "@/components/ButtonClose";
import { getHtmlJson, saveHtmlJson } from "@/lib/htmlStorage";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import type { HtmlNode } from "@/types/HtmlNode";

interface ImageMetadata {
  format: string;
  bytes: number;
  sizeFormatted: string;
  dimensions: string;
  width: number;
  height: number;
}

interface ImageItem {
  id: string;
  name: string;
  originalBase64: string;
  originalMeta: ImageMetadata;
  activeBase64: string;
  activeMeta: ImageMetadata;
  selected: boolean;
  isCropped?: boolean;
}

interface CropBox {
  x: number; // Percentage 0 - 100
  y: number; // Percentage 0 - 100
  width: number; // Percentage 0 - 100
  height: number; // Percentage 0 - 100
}

interface ModalAddImgProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSaveNodes?: (nodes: HtmlNode[]) => void;
}

export default function ModalAddImg({
  isOpen,
  setIsOpen,
  onSaveNodes,
}: ModalAddImgProps) {
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Compression Settings (Scale completely removed)
  const [quality, setQuality] = useState<number>(0.85);
  const [outputFormat, setOutputFormat] = useState<string>("image/webp");

  // Crop Box State (percentage-based)
  const [crop, setCrop] = useState<CropBox>({
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const [aspectRatio, setAspectRatio] = useState<
    "free" | "1:1" | "16:9" | "4:3"
  >("free");

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);

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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      handleResetAll();
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Compress single image without resizing/scaling
  const compressSingleImage = useCallback(
    (
      srcBase64: string,
      targetQuality: number,
      mimeType: string,
    ): Promise<{ activeBase64: string; activeMeta: ImageMetadata }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = srcBase64;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve({
              activeBase64: srcBase64,
              activeMeta: {
                format: "IMAGE",
                bytes: getBase64Size(srcBase64),
                sizeFormatted: formatFileSize(getBase64Size(srcBase64)),
                dimensions: `${img.naturalWidth} × ${img.naturalHeight} px`,
                width: img.naturalWidth,
                height: img.naturalHeight,
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
      });
    },
    [],
  );

  // Batch recompression when Quality or Output Format changes
  const recompressAll = useCallback(
    async (items: ImageItem[], q: number, fmt: string) => {
      if (items.length === 0) return;
      setIsCompressing(true);

      const updated = await Promise.all(
        items.map(async (item) => {
          // If already cropped, recompress activeBase64; otherwise recompress original
          const baseSource = item.isCropped
            ? item.activeBase64
            : item.originalBase64;
          const { activeBase64, activeMeta } = await compressSingleImage(
            baseSource,
            q,
            fmt,
          );
          return {
            ...item,
            activeBase64,
            activeMeta,
          };
        }),
      );

      setImageItems(updated);
      setIsCompressing(false);
    },
    [compressSingleImage],
  );

  useEffect(() => {
    if (imageItems.length > 0) {
      const timeout = setTimeout(() => {
        recompressAll(imageItems, quality, outputFormat);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [quality, outputFormat]);

  const activeItem =
    imageItems.find((it) => it.id === activeId) || imageItems[0] || null;

  // Process files from file input or drag-and-drop
  const processFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (validFiles.length === 0) {
      alert("Please select valid image files (PNG, JPG, WebP, SVG)");
      return;
    }

    const readers = validFiles.map((file) => {
      return new Promise<ImageItem | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          if (typeof reader.result === "string") {
            const dataUrl = reader.result;
            const img = new Image();
            img.src = dataUrl;
            img.onload = async () => {
              const format = file.type
                .replace("image/", "")
                .replace("+xml", "")
                .toUpperCase();

              const origMeta: ImageMetadata = {
                format: format || "IMAGE",
                bytes: file.size,
                sizeFormatted: formatFileSize(file.size),
                dimensions: `${img.naturalWidth} × ${img.naturalHeight} px`,
                width: img.naturalWidth,
                height: img.naturalHeight,
              };

              const { activeBase64, activeMeta } = await compressSingleImage(
                dataUrl,
                quality,
                outputFormat,
              );

              const id = `img_item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

              resolve({
                id,
                name: file.name,
                originalBase64: dataUrl,
                originalMeta: origMeta,
                activeBase64,
                activeMeta,
                selected: true,
                isCropped: false,
              });
            };
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((results) => {
      const added = results.filter(Boolean) as ImageItem[];
      setImageItems((prev) => {
        const next = [...prev, ...added];
        if (!activeId && next.length > 0) {
          setActiveId(next[0].id);
        }
        return next;
      });
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleResetAll = () => {
    setImageItems([]);
    setActiveId(null);
    setQuality(0.85);
    setOutputFormat("image/webp");
    setCrop({ x: 10, y: 10, width: 80, height: 80 });
    setAspectRatio("free");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleItemSelect = (id: string) => {
    setImageItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const removeItem = (id: string) => {
    setImageItems((prev) => {
      const filtered = prev.filter((it) => it.id !== id);
      if (activeId === id) {
        setActiveId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const selectAll = (val: boolean) => {
    setImageItems((prev) => prev.map((it) => ({ ...it, selected: val })));
  };

  // ─── CROP ENGINE ──────────────────────────────────────────────────────────

  const applyCrop = () => {
    if (!activeItem) return;

    const img = new Image();
    img.src = activeItem.originalBase64;
    img.onload = () => {
      const pixelX = Math.round((crop.x / 100) * img.naturalWidth);
      const pixelY = Math.round((crop.y / 100) * img.naturalHeight);
      const pixelW = Math.max(
        1,
        Math.round((crop.width / 100) * img.naturalWidth),
      );
      const pixelH = Math.max(
        1,
        Math.round((crop.height / 100) * img.naturalHeight),
      );

      const canvas = document.createElement("canvas");
      canvas.width = pixelW;
      canvas.height = pixelH;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      if (outputFormat === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pixelW, pixelH);
      }

      ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);

      const croppedBase64 = canvas.toDataURL(outputFormat, quality);
      const bytes = getBase64Size(croppedBase64);
      const formatLabel = outputFormat.replace("image/", "").toUpperCase();

      setImageItems((prev) =>
        prev.map((it) => {
          if (it.id === activeItem.id) {
            return {
              ...it,
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
            };
          }
          return it;
        }),
      );
    };
  };

  const resetCropToOriginal = async () => {
    if (!activeItem) return;

    const { activeBase64, activeMeta } = await compressSingleImage(
      activeItem.originalBase64,
      quality,
      outputFormat,
    );

    setImageItems((prev) =>
      prev.map((it) =>
        it.id === activeItem.id
          ? {
              ...it,
              activeBase64,
              activeMeta,
              isCropped: false,
            }
          : it,
      ),
    );
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
  };

  const setCropPreset = (ratio: "free" | "1:1" | "16:9" | "4:3") => {
    setAspectRatio(ratio);
    if (ratio === "free") {
      setCrop({ x: 10, y: 10, width: 80, height: 80 });
      return;
    }
    if (ratio === "1:1") {
      setCrop({ x: 15, y: 15, width: 70, height: 70 });
      return;
    }
    if (ratio === "16:9") {
      setCrop({ x: 10, y: 22, width: 80, height: 45 });
      return;
    }
    if (ratio === "4:3") {
      setCrop({ x: 10, y: 20, width: 80, height: 60 });
    }
  };

  // Drag & Resize crop rectangle
  const handleCropDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = previewContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const initialCrop = { ...crop };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const deltaXPercent =
        ((moveEvt.clientX - startMouseX) / rect.width) * 100;
      const deltaYPercent =
        ((moveEvt.clientY - startMouseY) / rect.height) * 100;

      let nextX = initialCrop.x + deltaXPercent;
      let nextY = initialCrop.y + deltaYPercent;

      nextX = Math.max(0, Math.min(100 - initialCrop.width, nextX));
      nextY = Math.max(0, Math.min(100 - initialCrop.height, nextY));

      setCrop({
        ...initialCrop,
        x: Math.round(nextX),
        y: Math.round(nextY),
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
    const startX = e.clientX;
    const startY = e.clientY;
    const init = { ...crop };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const dx = ((moveEvt.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvt.clientY - startY) / rect.height) * 100;

      let { x, y, width, height } = init;

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

      setCrop({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // ─── SAVE TO DB ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    const selected = imageItems.filter((i) => i.selected);
    if (selected.length === 0) return;

    const newNodes: HtmlNode[] = selected.map((item) => {
      const key = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const cleanAlt = item.name.replace(/\.[^/.]+$/, "");

      return {
        tag: "img",
        text: "",
        class: "",
        style:
          "max-width: 100%; height: auto; display: inline-block; vertical-align: middle;",
        children: [],
        attributes: {
          alt: cleanAlt || "image",
          src: item.activeBase64,
          width: item.activeMeta.width.toString(),
          height: item.activeMeta.height.toString(),
        },
        _key: key,
      };
    });

    try {
      const existing = await getHtmlJson(DB_KEY).catch(() => null);
      const currentList: HtmlNode[] = existing
        ? Array.isArray(existing)
          ? existing
          : [existing]
        : [];
      const nextList = [...currentList, ...newNodes];

      await saveHtmlJson(DB_KEY, nextList);

      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", {
          detail: { nodes: nextList, source: "modal-add-img" },
        }),
      );

      if (onSaveNodes) onSaveNodes(newNodes);
      setIsOpen(false);
    } catch (e) {
      console.error("[ModalAddImg] Persist error:", e);
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
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="fixed inset-0 w-screen h-screen bg-black/98 z-50 overflow-hidden flex flex-col justify-between p-4 sm:p-6"
        >
          {/* Header */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-neutral-100 tracking-wide flex items-center gap-2">
                <span>Crop & Optimize Images</span>
                {imageItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50 text-xs font-mono">
                    {imageItems.length} loaded
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Visual cropping and WebP/JPG/PNG compression for canvas assets
              </p>
            </div>
            <ButtonClose setClose={setIsOpen} />
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
          />

          {imageItems.length === 0 ? (
            /* Empty State / Dropzone */
            <div className="w-full max-w-2xl mx-auto my-auto flex flex-col items-center">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full h-[360px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                    : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 hover:bg-zinc-900/80"
                }`}
              >
                <div className="p-4 rounded-full bg-zinc-800 text-zinc-300 mb-4 shadow-inner">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-base font-medium text-neutral-200">
                  Click to browse or drop images here
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Supports multiple PNG, JPG, GIF, WebP files
                </p>
              </div>
            </div>
          ) : (
            /* Master-Detail Crop & Batch Workspace */
            <div className="w-full flex-1 my-3 flex flex-col lg:flex-row gap-4 overflow-hidden">
              {/* LEFT: Large Interactive Crop Workspace */}
              <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
                {/* Crop Toolbar */}
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
                            ? "bg-indigo-600 border-indigo-400 text-white font-bold"
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
                        Reset to Original
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={applyCrop}
                      className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs transition shadow-md active:scale-95"
                    >
                      ✂️ Apply Crop
                    </button>
                  </div>
                </div>

                {/* Viewport Area with Image & Draggable Box */}
                <div className="flex-1 p-4 flex items-center justify-center overflow-hidden bg-zinc-950/60 select-none">
                  {activeItem && (
                    <div
                      ref={previewContainerRef}
                      className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden rounded-lg shadow-xl border border-zinc-800"
                    >
                      {/* Base Image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={cropImageRef}
                        src={activeItem.originalBase64}
                        alt="Crop target"
                        className="max-h-[52vh] max-w-full object-contain pointer-events-none block"
                      />

                      {/* Interactive Crop Rectangle Overlay */}
                      <div
                        onPointerDown={handleCropDrag}
                        className="absolute border-2 border-indigo-400 bg-indigo-500/10 cursor-move"
                        style={{
                          left: `${crop.x}%`,
                          top: `${crop.y}%`,
                          width: `${crop.width}%`,
                          height: `${crop.height}%`,
                          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                        }}
                      >
                        {/* 4 Corner Resize Handles */}
                        <div
                          onPointerDown={(e) => handleResizeHandle("nw", e)}
                          className="absolute -top-1.5 -left-1.5 size-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow"
                        />
                        <div
                          onPointerDown={(e) => handleResizeHandle("ne", e)}
                          className="absolute -top-1.5 -right-1.5 size-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow"
                        />
                        <div
                          onPointerDown={(e) => handleResizeHandle("sw", e)}
                          className="absolute -bottom-1.5 -left-1.5 size-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow"
                        />
                        <div
                          onPointerDown={(e) => handleResizeHandle("se", e)}
                          className="absolute -bottom-1.5 -right-1.5 size-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow"
                        />

                        {/* Centered Guide Cross */}
                        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-indigo-300/20">
                          <div className="border-r border-b border-indigo-300/20" />
                          <div className="border-r border-b border-indigo-300/20" />
                          <div className="border-b border-indigo-300/20" />
                          <div className="border-r border-b border-indigo-300/20" />
                          <div className="border-r border-b border-indigo-300/20" />
                          <div className="border-b border-indigo-300/20" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info Footer of Active Image */}
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
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                          Cropped
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Batch Gallery & Compression Settings */}
              <div className="w-full lg:w-96 flex flex-col gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-hidden">
                {/* Batch Top Bar */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-zinc-300">
                    Images Queue ({imageItems.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800/80 font-bold transition"
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded bg-red-950/40 border border-red-900/50 transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Thumbnails Scrollable List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1 min-h-[160px]">
                  {imageItems.map((item) => {
                    const isCurrent = item.id === (activeItem?.id || "");
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveId(item.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                          isCurrent
                            ? "bg-zinc-800/90 border-indigo-500 shadow-md ring-1 ring-indigo-500/40"
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
                            className="rounded border-zinc-700 bg-zinc-800 text-indigo-600 accent-indigo-500 cursor-pointer"
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

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(item.id);
                          }}
                          className="text-zinc-500 hover:text-red-400 text-xs p-1 rounded transition"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Compression Parameters Box */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400">
                      Compression
                    </span>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="bg-zinc-900 text-zinc-200 border border-zinc-700 rounded px-2 py-0.5 text-xs outline-none cursor-pointer focus:border-indigo-500 font-mono"
                    >
                      <option value="image/webp">WEBP (Recommended)</option>
                      <option value="image/jpeg">JPEG</option>
                      <option value="image/png">PNG (Lossless)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Quality:</span>
                      <span className="font-mono text-indigo-400 font-bold">
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
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Batch Savings Summary */}
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
          )}

          {/* Bottom Action Bar */}
          <div className="w-full flex items-center justify-between pt-3 border-t border-zinc-800">
            <span className="text-xs text-zinc-500 font-mono">
              {selectedItems.length > 0
                ? `Ready to insert: ${selectedItems.length} image(s)`
                : "Select or drop images above"}
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
                disabled={selectedItems.length === 0 || isCompressing}
                onClick={handleSave}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition shadow-lg cursor-pointer ${
                  selectedItems.length > 0 && !isCompressing
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                }`}
              >
                {isCompressing
                  ? "Compressing..."
                  : `Save ${selectedItems.length > 0 ? `(${selectedItems.length})` : ""} to Canvas`}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
