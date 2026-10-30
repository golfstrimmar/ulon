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
  // Список всех загруженных картинок
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);

  // Пакетные настройки сжатия
  const [quality, setQuality] = useState<number>(0.8);
  const [scale, setScale] = useState<number>(1);
  const [outputFormat, setOutputFormat] = useState<string>("image/webp");

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Асинхронное сжатие одного изображения через Canvas
  const compressSingleImage = useCallback(
    (
      srcBase64: string,
      targetQuality: number,
      targetScale: number,
      mimeType: string,
    ): Promise<{ activeBase64: string; activeMeta: ImageMetadata }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = srcBase64;
        img.onload = () => {
          const targetWidth = Math.max(
            1,
            Math.round(img.naturalWidth * targetScale),
          );
          const targetHeight = Math.max(
            1,
            Math.round(img.naturalHeight * targetScale),
          );

          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
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
            ctx.fillRect(0, 0, targetWidth, targetHeight);
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const compressedDataUrl = canvas.toDataURL(mimeType, targetQuality);
          const bytes = getBase64Size(compressedDataUrl);
          const formatLabel = mimeType.replace("image/", "").toUpperCase();

          resolve({
            activeBase64: compressedDataUrl,
            activeMeta: {
              format: formatLabel,
              bytes,
              sizeFormatted: formatFileSize(bytes),
              dimensions: `${targetWidth} × ${targetHeight} px`,
              width: targetWidth,
              height: targetHeight,
            },
          });
        };
      });
    },
    [],
  );

  // Пакетный пересчет компрессии для всех загруженных изображений при изменении настроек
  const recompressAll = useCallback(
    async (items: ImageItem[], q: number, s: number, fmt: string) => {
      if (items.length === 0) return;
      setIsCompressing(true);

      const updated = await Promise.all(
        items.map(async (item) => {
          const { activeBase64, activeMeta } = await compressSingleImage(
            item.originalBase64,
            q,
            s,
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

  // Срабатывает при движении ползунков Quality, Scale или смене формата
  useEffect(() => {
    if (imageItems.length > 0) {
      const timeout = setTimeout(() => {
        recompressAll(imageItems, quality, scale, outputFormat);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [quality, scale, outputFormat]);

  // Обработка пачки файлов
  const processFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (validFiles.length === 0) {
      alert("Please select valid image files (PNG, JPG, WebP, etc.)");
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
                scale,
                outputFormat,
              );

              resolve({
                id: `img_item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                name: file.name,
                originalBase64: dataUrl,
                originalMeta: origMeta,
                activeBase64,
                activeMeta,
                selected: true,
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
      setImageItems((prev) => [...prev, ...added]);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleResetAll = () => {
    setImageItems([]);
    setQuality(0.8);
    setScale(1);
    setOutputFormat("image/webp");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleItemSelect = (id: string) => {
    setImageItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const removeItem = (id: string) => {
    setImageItems((prev) => prev.filter((it) => it.id !== id));
  };

  const selectAll = (val: boolean) => {
    setImageItems((prev) => prev.map((it) => ({ ...it, selected: val })));
  };

  // Сохранение всех выбранных изображений в базу данных
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

  // Статистика сжатия для всей пачки
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
          className="fixed inset-0 w-screen h-screen bg-black/98 z-50 overflow-y-auto custom-scrollbar flex flex-col items-center justify-between p-6 sm:p-8"
        >
          <div className="absolute top-6 right-8 z-10">
            <ButtonClose setClose={setIsOpen} />
          </div>

          <div className="w-full text-center mt-1">
            <h2 className="text-2xl font-bold text-neutral-100 tracking-wide">
              Batch Add Images
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
              Массовая загрузка картинок с оптимизацией и конвертацией в WebP
            </p>
          </div>

          <div className="w-full max-w-5xl my-auto flex flex-col items-center py-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple // 👈 Включен массовый выбор
              className="hidden"
            />

            {imageItems.length === 0 ? (
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
                  if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full max-w-2xl h-[320px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
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
                  Click to browse or drop multiple images here
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Поддерживает выбор десятков PNG, JPG, GIF, WebP одновременно
                </p>
              </div>
            ) : (
              /* Галерея загруженных изображений и массовые настройки */
              <div className="w-full flex flex-col gap-5">
                {/* Панель управления элементами */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-3 px-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-neutral-300">
                      Loaded: <b className="text-white">{imageItems.length}</b>{" "}
                      images
                    </span>
                    <span className="text-neutral-600">|</span>
                    <span className="text-xs font-medium text-blue-400">
                      Selected: <b>{selectedItems.length}</b>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => selectAll(true)}
                      className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => selectAll(false)}
                      className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition cursor-pointer"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-blue-400 hover:text-blue-300 px-2.5 py-1 rounded bg-blue-950/60 border border-blue-800/60 transition cursor-pointer font-medium"
                    >
                      + Add More Images
                    </button>
                    <button
                      onClick={handleResetAll}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-950/40 border border-red-900/40 transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Сетка миниатюр с данными */}
                <div className="w-full max-h-[320px] overflow-y-auto custom-scrollbar p-2 bg-neutral-950 border border-neutral-800/80 rounded-2xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {imageItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleItemSelect(item.id)}
                      className={`relative group p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition cursor-pointer ${
                        item.selected
                          ? "bg-neutral-900 border-blue-500/80 shadow-md ring-1 ring-blue-500/30"
                          : "bg-neutral-950/60 border-neutral-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* Чекбокс */}
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => {}}
                        className="absolute top-2 left-2 rounded border-neutral-700 bg-neutral-800 text-blue-600 accent-blue-500 cursor-pointer pointer-events-none"
                      />

                      {/* Удаление одной картинки */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id);
                        }}
                        title="Delete"
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-400 text-xs p-1 rounded transition"
                      >
                        ✕
                      </button>

                      {/* Картинка */}
                      <div className="w-full h-28 bg-neutral-950/80 rounded-lg overflow-hidden flex items-center justify-center p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.activeBase64}
                          alt={item.name}
                          className="max-w-full max-h-full object-contain pointer-events-none"
                        />
                      </div>

                      {/* Мета-информация под миниатюрой */}
                      <div className="flex flex-col gap-0.5 w-full">
                        <span
                          title={item.name}
                          className="text-[11px] text-neutral-200 font-medium truncate"
                        >
                          {item.name}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                          <span>{item.activeMeta.dimensions}</span>
                          <span className="text-emerald-400 font-bold">
                            {item.activeMeta.sizeFormatted}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Статистика общей экономии */}
                {selectedItems.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Total size:</span>
                      <span className="text-amber-400 font-mono font-bold">
                        {formatFileSize(totalActiveBytes)}
                      </span>
                      <span className="text-[11px] text-neutral-500 line-through">
                        ({formatFileSize(totalOriginalBytes)})
                      </span>
                    </div>

                    {totalSavedPercent > 0 && (
                      <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-mono font-semibold">
                        Saved: -{totalSavedPercent}%
                      </div>
                    )}
                  </div>
                )}

                {/* Блок пакетного сжатия и параметров */}
                <div className="w-full bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                    <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                      Batch Optimization & Compression
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
                    {/* Ползунок качества */}
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

                    {/* Ползунок масштаба разрешения */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-neutral-300">
                        <span>Scale (Resolution):</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {Math.round(scale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={scale}
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Нижний бар сохранения */}
          <div className="w-full max-w-5xl flex items-center justify-between pt-4 border-t border-neutral-800">
            <span className="text-xs text-neutral-500">
              {selectedItems.length > 0
                ? `Готово к сохранению: ${selectedItems.length} картинок`
                : "Выберите или загрузите изображения"}
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-sm font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={selectedItems.length === 0 || isCompressing}
                onClick={handleSave}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg cursor-pointer ${
                  selectedItems.length > 0 && !isCompressing
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95"
                    : "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50"
                }`}
              >
                {isCompressing
                  ? "Optimizing..."
                  : `Save ${selectedItems.length > 0 ? `(${selectedItems.length})` : ""} to Database`}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
