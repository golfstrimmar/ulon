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

interface CropRect {
  x: number; // percentage (0 - 100)
  y: number;
  w: number;
  h: number;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

interface ModalAddImgProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSaveNode?: (node: HtmlNode) => void;
}

export default function ModalAddImg({
  isOpen,
  setIsOpen,
  onSaveNode,
}: ModalAddImgProps) {
  // Первозданный загруженный файл (для отката)
  const [masterRawBase64, setMasterRawBase64] = useState<string | null>(null);

  // Текущее рабочее изображение (может быть уже обрезанным)
  const [originalBase64, setOriginalBase64] = useState<string | null>(null);
  const [originalMeta, setOriginalMeta] = useState<ImageMetadata | null>(null);

  // Сжатый финальный результат
  const [activeBase64, setActiveBase64] = useState<string | null>(null);
  const [activeMeta, setActiveMeta] = useState<ImageMetadata | null>(null);

  // Настройки компрессии
  const [quality, setQuality] = useState<number>(0.8);
  const [scale, setScale] = useState<number>(1);
  const [outputFormat, setOutputFormat] = useState<string>("image/webp");

  // Состояние кадрирования (Crop)
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [cropRect, setCropRect] = useState<CropRect>({
    x: 10,
    y: 10,
    w: 80,
    h: 80,
  });
  const [dragMode, setDragMode] = useState<DragMode>(null);

  const [altText, setAltText] = useState<string>("image");
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    rect: CropRect;
  }>({
    mouseX: 0,
    mouseY: 0,
    rect: { x: 10, y: 10, w: 80, h: 80 },
  });

  // Helper: Format bytes
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

  // 🔹 Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      handleReset();
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Client-side Canvas Image Compression
  const compressImage = useCallback(
    (
      srcBase64: string,
      targetQuality: number,
      targetScale: number,
      mimeType: string,
    ) => {
      const img = new Image();
      img.src = srcBase64;
      img.onload = () => {
        const targetWidth = Math.round(img.naturalWidth * targetScale);
        const targetHeight = Math.round(img.naturalHeight * targetScale);

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        if (mimeType === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const compressedDataUrl = canvas.toDataURL(mimeType, targetQuality);
        const bytes = getBase64Size(compressedDataUrl);
        const formatLabel = mimeType.replace("image/", "").toUpperCase();

        setActiveBase64(compressedDataUrl);
        setActiveMeta({
          format: formatLabel,
          bytes,
          sizeFormatted: formatFileSize(bytes),
          dimensions: `${targetWidth} × ${targetHeight} px`,
          width: targetWidth,
          height: targetHeight,
        });
      };
    },
    [],
  );

  // Пересчет сжатия
  useEffect(() => {
    if (originalBase64 && !isCropping) {
      compressImage(originalBase64, quality, scale, outputFormat);
    }
  }, [quality, scale, outputFormat, originalBase64, isCropping, compressImage]);

  // Загрузка файла
  const processFile = (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP, etc.)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const dataUrl = reader.result;
        setMasterRawBase64(dataUrl);
        setOriginalBase64(dataUrl);

        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setAltText(cleanName || "image");

        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          const format = file.type
            .replace("image/", "")
            .replace("+xml", "")
            .toUpperCase();

          const initialMeta: ImageMetadata = {
            format: format || "IMAGE",
            bytes: file.size,
            sizeFormatted: formatFileSize(file.size),
            dimensions: `${img.naturalWidth} × ${img.naturalHeight} px`,
            width: img.naturalWidth,
            height: img.naturalHeight,
          };

          setOriginalMeta(initialMeta);
          compressImage(dataUrl, quality, scale, outputFormat);
        };
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // 🔹 Логика перетаскивания и ресайза рамки кадрирования
  const handlePointerDown = (mode: DragMode, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      rect: { ...cropRect },
    };
  };

  useEffect(() => {
    if (!dragMode) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!cropContainerRef.current) return;
      const bounds = cropContainerRef.current.getBoundingClientRect();
      const deltaX =
        ((e.clientX - dragStartRef.current.mouseX) / bounds.width) * 100;
      const deltaY =
        ((e.clientY - dragStartRef.current.mouseY) / bounds.height) * 100;
      const init = dragStartRef.current.rect;

      setCropRect(() => {
        let { x, y, w, h } = init;

        if (dragMode === "move") {
          x = Math.max(0, Math.min(100 - w, x + deltaX));
          y = Math.max(0, Math.min(100 - h, y + deltaY));
        } else if (dragMode === "se") {
          w = Math.max(5, Math.min(100 - x, init.w + deltaX));
          h = Math.max(5, Math.min(100 - y, init.h + deltaY));
        } else if (dragMode === "sw") {
          const newW = Math.max(5, Math.min(init.x + init.w, init.w - deltaX));
          x = init.x + (init.w - newW);
          w = newW;
          h = Math.max(5, Math.min(100 - y, init.h + deltaY));
        } else if (dragMode === "ne") {
          w = Math.max(5, Math.min(100 - x, init.w + deltaX));
          const newH = Math.max(5, Math.min(init.y + init.h, init.h - deltaY));
          y = init.y + (init.h - newH);
          h = newH;
        } else if (dragMode === "nw") {
          const newW = Math.max(5, Math.min(init.x + init.w, init.w - deltaX));
          x = init.x + (init.w - newW);
          w = newW;
          const newH = Math.max(5, Math.min(init.y + init.h, init.h - deltaY));
          y = init.y + (init.h - newH);
          h = newH;
        }

        return { x, y, w, h };
      });
    };

    const onPointerUp = () => setDragMode(null);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragMode]);

  // 🔹 Применение обрезки через Canvas
  const handleApplyCrop = () => {
    if (!originalBase64) return;

    const img = new Image();
    img.src = originalBase64;
    img.onload = () => {
      const cropX = (cropRect.x / 100) * img.naturalWidth;
      const cropY = (cropRect.y / 100) * img.naturalHeight;
      const cropW = (cropRect.w / 100) * img.naturalWidth;
      const cropH = (cropRect.h / 100) * img.naturalHeight;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(cropW);
      canvas.height = Math.round(cropH);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const croppedBase64 = canvas.toDataURL("image/png");
      const bytes = getBase64Size(croppedBase64);

      setOriginalBase64(croppedBase64);
      setOriginalMeta({
        format: "PNG",
        bytes,
        sizeFormatted: formatFileSize(bytes),
        dimensions: `${canvas.width} × ${canvas.height} px`,
        width: canvas.width,
        height: canvas.height,
      });

      setIsCropping(false);
      compressImage(croppedBase64, quality, scale, outputFormat);
    };
  };

  // Откат к оригиналу до обрезки
  const handleRevertToOriginal = () => {
    if (!masterRawBase64) return;
    setOriginalBase64(masterRawBase64);
    setIsCropping(false);
  };

  const handleReset = () => {
    setMasterRawBase64(null);
    setOriginalBase64(null);
    setOriginalMeta(null);
    setActiveBase64(null);
    setActiveMeta(null);
    setIsCropping(false);
    setQuality(0.8);
    setScale(1);
    setAltText("image");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ Корректное добавление ноды к существующему дереву
  const handleSave = async () => {
    if (!activeBase64) return;

    const key = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newNode: HtmlNode = {
      tag: "img",
      text: "",
      class: "img-fluid",
      style:
        "max-width: 100%; height: auto; display: inline-block; vertical-align: middle;",
      children: [],
      attributes: {
        alt: altText.trim() || "image",
        src: activeBase64,
        ...(activeMeta
          ? {
              width: activeMeta.width.toString(),
              height: activeMeta.height.toString(),
            }
          : {}),
      },
      _key: key,
    };

    try {
      // 1. Читаем текущее дерево из базы данных
      const existing = await getHtmlJson(DB_KEY).catch(() => null);
      const currentList: HtmlNode[] = existing
        ? Array.isArray(existing)
          ? existing
          : [existing]
        : [];

      // 2. Добавляем новую ноду в конец списка, сохраняя все существующие
      const nextList = [...currentList, newNode];

      // 3. Сохраняем полный обновленный массив
      await saveHtmlJson(DB_KEY, nextList);

      // 4. Оповещаем CanvasArea и PreviewArea
      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", {
          detail: { nodes: nextList, source: "modal-add-img" },
        }),
      );

      if (onSaveNode) onSaveNode(newNode);
      setIsOpen(false);
    } catch (e) {
      console.error("[ModalAddImg] Persist error:", e);
    }
  };

  const savedPercent =
    originalMeta && activeMeta && originalMeta.bytes > 0
      ? Math.round(
          ((originalMeta.bytes - activeMeta.bytes) / originalMeta.bytes) * 100,
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
          className="fixed inset-0 w-screen h-screen bg-black/98 z-50 overflow-y-auto no-scrollbar flex flex-col items-center justify-between p-6 sm:p-10"
        >
          {/* Close button */}
          <div className="absolute top-6 right-8 z-10">
            <ButtonClose setClose={setIsOpen} />
          </div>

          {/* Header */}
          <div className="w-full text-center mt-2">
            <h2 className="text-2xl font-bold text-neutral-100 tracking-wide">
              {isCropping ? "Crop Image" : "Add Image"}
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              {isCropping
                ? "Drag the frame or corners to crop your image"
                : "Upload, crop, optimize and add images to canvas"}
            </p>
          </div>

          {/* Main workspace */}
          <div className="w-full max-w-4xl my-auto flex flex-col items-center py-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {!activeBase64 ? (
              /* Dropzone */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full h-[360px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
                    : "border-neutral-700 hover:border-neutral-500 bg-neutral-900/50 hover:bg-neutral-900/80"
                }`}
              >
                <div className="p-4 rounded-full bg-neutral-800 text-neutral-300 mb-4 shadow-inner">
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
                  Click to browse or drop your image here
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Supports: PNG, JPG, GIF, WebP, SVG
                </p>
              </div>
            ) : (
              /* Preview, Crop & Compression Area */
              <div className="w-full flex flex-col items-center gap-5">
                {/* Image Container / Crop Canvas */}
                <div className="relative w-[95vw] flex items-center justify-center bg-neutral-950/80 border border-neutral-800 rounded-2xl p-3 overflow-hidden shadow-2xl">
                  <div
                    ref={cropContainerRef}
                    className="relative inline-block max-w-full select-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={isCropping ? originalBase64! : activeBase64}
                      alt={altText}
                      className="max-w-full h-auto object-contain rounded-lg shadow-lg pointer-events-none"
                    />

                    {/* Crop Overlay & Resizable Box */}
                    {isCropping && (
                      <div
                        style={{
                          left: `${cropRect.x}%`,
                          top: `${cropRect.y}%`,
                          width: `${cropRect.w}%`,
                          height: `${cropRect.h}%`,
                          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                        }}
                        onPointerDown={(e) => handlePointerDown("move", e)}
                        className="absolute border-2 border-white cursor-move z-20 group"
                      >
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                          <div className="border-r border-b border-white/60"></div>
                          <div className="border-r border-b border-white/60"></div>
                          <div className="border-b border-white/60"></div>
                          <div className="border-r border-b border-white/60"></div>
                          <div className="border-r border-b border-white/60"></div>
                          <div className="border-b border-white/60"></div>
                          <div className="border-r border-b border-white/60"></div>
                          <div className="border-r border-b border-white/60"></div>
                          <div></div>
                        </div>

                        <div
                          onPointerDown={(e) => handlePointerDown("nw", e)}
                          className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize shadow-md"
                        />
                        <div
                          onPointerDown={(e) => handlePointerDown("ne", e)}
                          className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize shadow-md"
                        />
                        <div
                          onPointerDown={(e) => handlePointerDown("sw", e)}
                          className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize shadow-md"
                        />
                        <div
                          onPointerDown={(e) => handlePointerDown("se", e)}
                          className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-se-resize shadow-md"
                        />
                      </div>
                    )}
                  </div>

                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {isCropping ? (
                      <>
                        <button
                          onClick={() => setIsCropping(false)}
                          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-3 py-1.5 rounded-md backdrop-blur-md transition-all cursor-pointer font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleApplyCrop}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-md backdrop-blur-md transition-all cursor-pointer font-semibold shadow-lg shadow-emerald-600/30"
                        >
                          Apply Crop
                        </button>
                      </>
                    ) : (
                      <>
                        {masterRawBase64 !== originalBase64 && (
                          <button
                            onClick={handleRevertToOriginal}
                            className="bg-black/75 hover:bg-neutral-700 text-neutral-300 text-xs px-3 py-1.5 rounded-md backdrop-blur-md transition-all cursor-pointer"
                          >
                            Revert Original
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setCropRect({ x: 10, y: 10, w: 80, h: 80 });
                            setIsCropping(true);
                          }}
                          className="bg-black/75 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-md backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2"
                            />
                          </svg>
                          Crop Image
                        </button>
                        <button
                          onClick={handleReset}
                          className="bg-black/75 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-md backdrop-blur-md transition-all cursor-pointer"
                        >
                          Replace Image
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!isCropping && activeMeta && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Format:</span>
                      <span className="text-blue-400 font-mono font-bold">
                        {activeMeta.format}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Dimensions:</span>
                      <span className="text-emerald-400 font-mono">
                        {activeMeta.dimensions}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Size:</span>
                      <span className="text-amber-400 font-mono font-bold">
                        {activeMeta.sizeFormatted}
                      </span>
                      {originalMeta && (
                        <span className="text-[11px] text-neutral-500 line-through">
                          ({originalMeta.sizeFormatted})
                        </span>
                      )}
                    </div>

                    {savedPercent > 0 && (
                      <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-mono font-semibold">
                        -{savedPercent}%
                      </div>
                    )}
                  </div>
                )}

                {!isCropping && (
                  <>
                    <div className="w-full max-w-2xl bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                        <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                          Optimization & Compression
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-neutral-500">Output:</span>
                          <select
                            value={outputFormat}
                            onChange={(e) => setOutputFormat(e.target.value)}
                            className="bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-0.5 outline-none text-xs cursor-pointer focus:border-blue-500"
                          >
                            <option value="image/webp">WEBP (Best)</option>
                            <option value="image/jpeg">JPEG</option>
                            <option value="image/png">PNG (Lossless)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-neutral-300">
                            <span>Quality:</span>
                            <span className="font-mono text-blue-400 font-semibold">
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
                            onChange={(e) =>
                              setQuality(parseFloat(e.target.value))
                            }
                            className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-neutral-300">
                            <span>Scale (Resolution):</span>
                            <span className="font-mono text-emerald-400 font-semibold">
                              {Math.round(scale * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="1"
                            step="0.05"
                            value={scale}
                            onChange={(e) =>
                              setScale(parseFloat(e.target.value))
                            }
                            className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="w-full max-w-2xl flex flex-col gap-1.5">
                      <label className="text-xs text-neutral-400 font-medium">
                        Alt text (SEO & accessibility description):
                      </label>
                      <input
                        type="text"
                        value={altText}
                        onChange={(e) => setAltText(e.target.value)}
                        placeholder="e.g. Beautiful mountain landscape"
                        className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-all"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action buttons footer */}
          <div className="w-full max-w-4xl flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
            <button
              onClick={() => setIsOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-sm font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={!activeBase64 || isCropping}
              onClick={handleSave}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg cursor-pointer ${
                activeBase64 && !isCropping
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95"
                  : "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50"
              }`}
            >
              Save to Database
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
