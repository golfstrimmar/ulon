"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ButtonClose from "@/components/ButtonClose";
import { saveHtmlJson } from "@/lib/htmlStorage";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";

// HtmlNode type definition
export type HtmlNode = {
  tag: string;
  text?: string;
  class: string;
  style: string;
  attributes?: Record<string, string>;
  _key?: string;
  _isNew?: boolean;
  children: HtmlNode[] | string;
};

interface ImageMetadata {
  format: string;
  bytes: number;
  sizeFormatted: string;
  dimensions: string;
  width: number;
  height: number;
}

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
  // Исходный файл
  const [originalBase64, setOriginalBase64] = useState<string | null>(null);
  const [originalMeta, setOriginalMeta] = useState<ImageMetadata | null>(null);

  // Сжатый результат
  const [activeBase64, setActiveBase64] = useState<string | null>(null);
  const [activeMeta, setActiveMeta] = useState<ImageMetadata | null>(null);

  // Настройки компрессии
  const [quality, setQuality] = useState<number>(0.8); // 10% - 100%
  const [scale, setScale] = useState<number>(1); // 20% - 100%
  const [outputFormat, setOutputFormat] = useState<string>("image/webp");

  const [altText, setAltText] = useState<string>("image");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Format bytes to human readable string
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Helper: Calculate Base64 string byte size
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

        // Белая подложка для JPEG (иначе прозрачность становится черной)
        if (mimeType === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Получаем сжатую Data URL
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

  // Пересчет сжатия при изменении ползунков или формата
  useEffect(() => {
    if (originalBase64) {
      compressImage(originalBase64, quality, scale, outputFormat);
    }
  }, [quality, scale, outputFormat, originalBase64, compressImage]);

  // Загрузка файла с диска
  const processFile = (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP, etc.)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const dataUrl = reader.result;
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
          // Сразу запускаем базовое сжатие (по умолчанию WebP 80%)
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleReset = () => {
    setOriginalBase64(null);
    setOriginalMeta(null);
    setActiveBase64(null);
    setActiveMeta(null);
    setQuality(0.8);
    setScale(1);
    setAltText("image");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Build HtmlNode structure and save
  const handleSave = async () => {
    if (!activeBase64) return;

    const newNode: HtmlNode = {
      tag: "img",
      text: "",
      class: "",
      style: "",
      children: [],
      attributes: {
        alt: altText.trim() || "image",
        src: activeBase64,
      },
      _key:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(),
      _isNew: true,
    };

    const AddNewNode = async () => {
      try {
        await saveHtmlJson(DB_KEY, newNode);

        window.dispatchEvent(
          new CustomEvent("plaza-tree-updated", { detail: newNode }),
        );
      } catch (e) {
        console.error("[useCanvasArea] Persist error:", e);
      }
    };

    if (newNode) {
      await AddNewNode();
      if (onSaveNode) onSaveNode(newNode);
    }

    setIsOpen(false);
  };

  // Расчет процента экономии памяти
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
          className="fixed inset-0 w-screen h-screen bg-black/95 z-50 overflow-y-auto no-scrollbar flex flex-col items-center justify-between p-6 sm:p-10"
        >
          {/* Close button */}
          <div className="absolute top-6 right-8 z-10">
            <ButtonClose setClose={setIsOpen} />
          </div>

          {/* Header */}
          <div className="w-full max-w-4xl text-center mt-2">
            <h2 className="text-2xl font-bold text-neutral-100 tracking-wide">
              Add Image
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Upload, optimize, compress and add images to canvas
            </p>
          </div>

          {/* Main workspace */}
          <div className="w-full max-w-4xl my-6 flex flex-col items-center">
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
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
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
              /* Large Preview & Compression Settings */
              <div className="w-full flex flex-col items-center gap-5">
                {/* Large Preview */}
                <div className="relative max-h-[42vh] w-full flex items-center justify-center bg-neutral-950/80 border border-neutral-800 rounded-2xl p-3 overflow-hidden shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeBase64}
                    alt={altText}
                    className="max-h-[38vh] max-w-full h-auto object-contain rounded-lg shadow-lg"
                  />
                  <button
                    onClick={handleReset}
                    className="absolute top-4 right-4 bg-black/75 hover:bg-red-600/90 text-white text-xs px-3 py-1.5 rounded-md backdrop-blur-md transition-all duration-200 cursor-pointer"
                  >
                    Replace Image
                  </button>
                </div>

                {/* Metadata & Comparative Badges */}
                {activeMeta && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {/* Format Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Format:</span>
                      <span className="text-blue-400 font-mono font-bold">
                        {activeMeta.format}
                      </span>
                    </div>

                    {/* Dimensions Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Dimensions:</span>
                      <span className="text-emerald-400 font-mono">
                        {activeMeta.dimensions}
                      </span>
                    </div>

                    {/* File Size Badge */}
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

                    {/* Saved percentage */}
                    {savedPercent > 0 && (
                      <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-mono font-semibold">
                        -{savedPercent}%
                      </div>
                    )}
                  </div>
                )}

                {/* Compression Controls Panel */}
                <div className="w-full max-w-2xl bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                    <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                      Optimization & Compression
                    </span>
                    {/* Format Selector */}
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
                    {/* Quality Slider */}
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
                        onChange={(e) => setQuality(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40"
                      />
                    </div>

                    {/* Resolution Scale Slider */}
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
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Alt attribute input */}
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
              disabled={!activeBase64}
              onClick={handleSave}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg cursor-pointer ${
                activeBase64
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
