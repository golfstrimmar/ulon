"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePixelPerfect } from "@/app/plaza/components/PreviewArea/hooks/usePixelPerfect";

export default function ModalPixelPerfect() {
  const {
    image,
    fileName,
    imageWidth,
    imageHeight,
    previewOpacity,
    offsetX,
    offsetY,
    isVisible,
    align,
    fitHeight,
    isModalOpen,
    loadImageFile,
    removeImage,
    setPreviewOpacity,
    setOffsetX,
    setOffsetY,
    setIsVisible,
    toggleVisible,
    setAlign,
    setFitHeight,
    resetPosition,
    setIsModalOpen,
  } = usePixelPerfect();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Закрытие по Escape
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, setIsModalOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setErrorMsg("");
        await loadImageFile(file);
      } catch (err: any) {
        setErrorMsg(err.message || "Ошибка чтения файла");
      }
    }
    // Сбрасываем значение инпута, чтобы можно было выбрать тот же файл повторно
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      try {
        setErrorMsg("");
        await loadImageFile(file);
      } catch (err: any) {
        setErrorMsg(err.message || "Ошибка чтения файла");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col z-10 text-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/90">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <span className="text-sm font-semibold font-mono tracking-tight text-zinc-100">
                  Pixel Perfect Подложка
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title="Закрыть (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Скрытый input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* 1. Блок добавления / управления файлом */}
              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 font-semibold mb-1.5 block">
                  Изображение макета:
                </label>

                {!image ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                      isDragging
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                        : "border-zinc-700 hover:border-indigo-400/70 bg-zinc-800/40 hover:bg-zinc-800/70 text-zinc-400"
                    }`}
                  >
                    <span className="text-3xl mb-1.5">🖼️</span>
                    <span className="text-xs font-medium text-zinc-200 mb-0.5">
                      Нажмите для выбора или перетащите файл
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      PNG, JPG, WEBP, SVG из файловой системы
                    </span>
                  </div>
                ) : (
                  <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5 flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700/60 shrink-0 flex items-center justify-center">
                      <img
                        src={image}
                        alt="Макет"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-mono font-medium text-zinc-200 truncate"
                        title={fileName}
                      >
                        {fileName || "Подложка макета"}
                      </p>
                      {imageWidth > 0 && imageHeight > 0 && (
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                          {imageWidth} × {imageHeight} px
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Заменить файл
                        </button>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={removeImage}
                      title="Удалить подложку"
                      className="px-2 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-200 bg-red-950/30 hover:bg-red-900/50 border border-red-800/50 transition cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span>🗑️</span>
                      <span className="text-[10px] font-mono">Удалить</span>
                    </button>
                  </div>
                )}

                {errorMsg && (
                  <p className="text-xs text-red-400 mt-1.5 font-mono">
                    ⚠️ {errorMsg}
                  </p>
                )}
              </div>

              {/* 2. Ползунок прозрачности верстки (превью) */}
              <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <span>👁️‍🗨️</span> Прозрачность верстки (превью):
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-indigo-300">
                    {previewOpacity}%
                  </span>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={previewOpacity}
                  onChange={(e) => setPreviewOpacity(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
                />

                {/* Presets */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  {[0, 25, 50, 75, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPreviewOpacity(val)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded transition cursor-pointer border ${
                        previewOpacity === val
                          ? "bg-indigo-600 border-indigo-400 text-white font-bold"
                          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {val === 0 ? "0% (макет)" : val === 100 ? "100%" : `${val}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Позиционирование и подгонка (Pixel Perfect) */}
              {image && (
                <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <span>📐</span> Подгонка подложки
                    </span>

                    {/* Toggle Visibility */}
                    <button
                      type="button"
                      onClick={toggleVisible}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer flex items-center gap-1 ${
                        isVisible
                          ? "bg-emerald-950/70 border-emerald-600/70 text-emerald-300"
                          : "bg-zinc-800 border-zinc-700 text-zinc-500"
                      }`}
                      title={isVisible ? "Скрыть подложку" : "Показать подложку"}
                    >
                      <span>{isVisible ? "👁️ Видима" : "👁️‍🗨️ Скрыта"}</span>
                    </button>
                  </div>

                  {/* Смещение X / Y */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* X Offset */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-zinc-400">
                          Смещение X (px):
                        </span>
                        <span className="text-[10px] font-mono text-zinc-300">
                          {offsetX > 0 ? `+${offsetX}` : offsetX}px
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setOffsetX(offsetX - 1)}
                          className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 cursor-pointer"
                          title="-1px"
                        >
                          -1
                        </button>
                        <input
                          type="number"
                          value={offsetX}
                          onChange={(e) => setOffsetX(Number(e.target.value) || 0)}
                          className="w-full text-center px-1.5 py-1 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setOffsetX(offsetX + 1)}
                          className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 cursor-pointer"
                          title="+1px"
                        >
                          +1
                        </button>
                      </div>
                    </div>

                    {/* Y Offset */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-zinc-400">
                          Смещение Y (px):
                        </span>
                        <span className="text-[10px] font-mono text-zinc-300">
                          {offsetY > 0 ? `+${offsetY}` : offsetY}px
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setOffsetY(offsetY - 1)}
                          className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 cursor-pointer"
                          title="-1px"
                        >
                          -1
                        </button>
                        <input
                          type="number"
                          value={offsetY}
                          onChange={(e) => setOffsetY(Number(e.target.value) || 0)}
                          className="w-full text-center px-1.5 py-1 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setOffsetY(offsetY + 1)}
                          className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 cursor-pointer"
                          title="+1px"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reset & Alignment Controls */}
                  <div className="flex items-center justify-between pt-1 gap-2">
                    {/* Alignment */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">
                        Выравнивание:
                      </span>
                      <button
                        type="button"
                        onClick={() => setAlign("left")}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                          align === "left"
                            ? "bg-indigo-600 border-indigo-400 text-white font-semibold"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        Слева
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlign("center")}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                          align === "center"
                            ? "bg-indigo-600 border-indigo-400 text-white font-semibold"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        Центр
                      </button>
                    </div>

                    {(offsetX !== 0 || offsetY !== 0) && (
                      <button
                        type="button"
                        onClick={resetPosition}
                        className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                      >
                        Сбросить (0, 0)
                      </button>
                    )}
                  </div>

                  {/* Fit Height Checkbox */}
                  <label className="flex items-center gap-2 pt-1 text-xs text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fitHeight}
                      onChange={(e) => setFitHeight(e.target.checked)}
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                    <span className="text-[11px] text-zinc-400">
                      Растягивать высоту превью под размер макета
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-[11px] text-zinc-500">
              <span>💡 Подложка лежит под версткой</span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer"
              >
                Готово
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
