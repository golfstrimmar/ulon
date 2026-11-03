"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  TrashIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  CheckCircleIcon,
  ArrowUpTrayIcon,
  PhotoIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import {
  getAllFragments,
  saveFragment,
  deleteFragment,
  type FigmaJsonFragment,
} from "@/lib/figmaJsonStorage";
import { useFigmaImagesController } from "@/app/design/controllers/useFigmaImagesController";
import { useFigmaSvgController } from "@/app/design/controllers/useFigmaSvgController";
import ModalFigmaImageCrop from "@/app/design/components/ModalFigmaImageCrop";
import ModalFigmaSvgBatch from "@/app/design/components/ModalFigmaSvgBatch";

interface FigmaJsonInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  error?: string | null;
}

export function FigmaJsonInput({
  value,
  onChange,
  onClear,
  error,
}: FigmaJsonInputProps) {
  const [fragments, setFragments] = useState<FigmaJsonFragment[]>([]);
  const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Модальное окно названия фрагмента
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const [fragmentName, setFragmentName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // 🔹 Контроллер картинок из JSON
  const {
    images,
    imagesCount,
    hasImages,
    isModalOpen: isImagesModalOpen,
    setIsModalOpen: setIsImagesModalOpen,
    saveImagesToTree,
  } = useFigmaImagesController(value);

  // 🔹 Контроллер SVG из JSON
  const {
    svgs,
    svgsCount,
    hasSvgs,
    isModalOpen: isSvgModalOpen,
    setIsModalOpen: setIsSvgModalOpen,
    saveSvgsToTree,
  } = useFigmaSvgController(value);

  const loadFragments = useCallback(async () => {
    try {
      const list = await getAllFragments();
      setFragments(list);
    } catch (err) {
      console.error("Ошибка при загрузке фрагментов из базы:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFragments();

    const handleUpdated = () => {
      loadFragments();
    };

    window.addEventListener("figma_fragments:updated", handleUpdated);
    return () => {
      window.removeEventListener("figma_fragments:updated", handleUpdated);
    };
  }, [loadFragments]);

  useEffect(() => {
    if (isModalOpen) {
      setNameError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isModalOpen]);

  const handleSelectFragment = (fragment: FigmaJsonFragment) => {
    setActiveFragmentId(fragment.id);
    onChange(fragment.json);
  };

  const handleDeleteFragment = async (
    e: React.MouseEvent,
    id: string,
    name: string,
  ) => {
    e.stopPropagation();

    try {
      await deleteFragment(id);
      if (activeFragmentId === id) {
        setActiveFragmentId(null);
        onClear();
      }
      await loadFragments();
    } catch (err) {
      console.error("Ошибка при удалении фрагмента:", err);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text || !text.trim()) return;

    e.preventDefault();
    initiateNewFragment(text.trim());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text && text.trim()) {
          const suggestedName = file.name.replace(/\.[^/.]+$/, "");
          initiateNewFragment(text.trim(), suggestedName);
        }
      };
      reader.readAsText(file);
    } else {
      const text = e.dataTransfer.getData("text");
      if (text && text.trim()) {
        initiateNewFragment(text.trim());
      }
    }
  };

  const initiateNewFragment = (jsonText: string, defaultName = "") => {
    setPendingJson(jsonText);
    setFragmentName(defaultName);
    setNameError(null);
    setIsModalOpen(true);
  };

  const handleConfirmSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = fragmentName.trim();
    if (!trimmedName) {
      setNameError("Обязательно укажите название фрагмента!");
      inputRef.current?.focus();
      return;
    }

    if (!pendingJson) return;

    try {
      setIsSaving(true);
      const saved = await saveFragment(trimmedName, pendingJson);
      setActiveFragmentId(saved.id);
      onChange(saved.json);
      setIsModalOpen(false);
      setPendingJson(null);
      setFragmentName("");
      setNameError(null);
      await loadFragments();
    } catch (err) {
      console.error("Ошибка сохранения фрагмента в базу:", err);
      setNameError("Ошибка при сохранении в базу данных");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelModal = () => {
    setIsModalOpen(false);
    setPendingJson(null);
    setFragmentName("");
    setNameError(null);
  };

  const handleClear = () => {
    setActiveFragmentId(null);
    onClear();
  };

  const activeFragment = fragments.find((f) => f.id === activeFragmentId);

  return (
    <section className="flex flex-col gap-4 w-full">
      {/* =========================================================================
          ПЛАШКА БАНКА СОХРАНЕННЫХ JSON ФРАГМЕНТОВ
          ========================================================================= */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 shadow-md backdrop-blur-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FolderIcon className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              Банк JSON фрагментов
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50">
              {fragments.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeFragment && (
              <span className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-950/40 border border-blue-800/50 px-2.5 py-1 rounded-lg">
                <CheckCircleIcon className="w-4 h-4 text-blue-400" />
                Активен:{" "}
                <span className="font-semibold text-zinc-100">
                  {activeFragment.name}
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700/60 transition"
              title="Создать / вставить новый фрагмент"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Новый
            </button>
          </div>
        </div>

        {/* Список кнопок фрагментов */}
        <div className="min-h-[42px] flex items-center">
          {isLoading ? (
            <div className="text-xs text-zinc-500 py-1">Загрузка банка...</div>
          ) : fragments.length === 0 ? (
            <div className="text-xs text-zinc-500 py-1 flex items-center gap-2">
              <span>📭 Банк пуст.</span>
              <span>
                Вставьте JSON из Figma ниже — откроется запрос названия для
                сохранения в базу.
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 w-full">
              {fragments.map((frag) => {
                const isActive = frag.id === activeFragmentId;
                return (
                  <div
                    key={frag.id}
                    className={`group inline-flex items-center rounded-xl border transition-all ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30 font-medium"
                        : "bg-zinc-900 hover:bg-zinc-800/90 text-zinc-300 hover:text-white border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectFragment(frag)}
                      className="px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                      title={`Загрузить: ${frag.name} (${new Date(frag.createdAt).toLocaleDateString()})`}
                    >
                      <DocumentDuplicateIcon
                        className={`w-3.5 h-3.5 ${
                          isActive
                            ? "text-blue-200"
                            : "text-zinc-400 group-hover:text-zinc-200"
                        }`}
                      />
                      <span>{frag.name}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) =>
                        handleDeleteFragment(e, frag.id, frag.name)
                      }
                      className={`p-1.5 pr-2 rounded-r-xl transition cursor-pointer ${
                        isActive
                          ? "hover:bg-blue-700 text-blue-200 hover:text-white"
                          : "hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                      }`}
                      title={`Удалить «${frag.name}» из базы`}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          ПОЛЕ ВВОДА FIGMA PLUGIN JSON
          ========================================================================= */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col gap-2 w-full rounded-2xl border p-4 bg-zinc-900/60 transition-colors ${
          isDragging
            ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/20"
            : "border-zinc-800"
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label
            htmlFor="figma-json-input"
            className="text-sm font-semibold text-zinc-200 flex items-center gap-2"
          >
            <span>Figma Plugin JSON</span>
            {activeFragment && (
              <span className="text-xs font-normal text-zinc-400">
                — {activeFragment.name}
              </span>
            )}
          </label>

          <div className="flex items-center gap-2">
            {/* 🖼️ КНОПКА КАРТИНОК ИЗ JSON */}
            {hasImages && (
              <button
                type="button"
                onClick={() => setIsImagesModalOpen(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-950 animate-pulse cursor-pointer"
                title="Crop and optimize images from this JSON"
              >
                <PhotoIcon className="w-3.5 h-3.5" />
                <span>Images ({imagesCount})</span>
              </button>
            )}

            {/* ⚡ КНОПКА SVG ИЗ JSON */}
            {hasSvgs && (
              <button
                type="button"
                onClick={() => setIsSvgModalOpen(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-md shadow-amber-950 animate-pulse cursor-pointer"
                title="Configure and insert SVGs from this JSON"
              >
                <BoltIcon className="w-3.5 h-3.5" />
                <span>SVGs ({svgsCount})</span>
              </button>
            )}

            {value && !activeFragment && (
              <button
                type="button"
                onClick={() => initiateNewFragment(value)}
                className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition cursor-pointer"
              >
                Сохранить в банк
              </button>
            )}
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            id="figma-json-input"
            rows={7}
            value={value}
            onPaste={handlePaste}
            onChange={(e) => {
              setActiveFragmentId(null);
              onChange(e.target.value);
            }}
            placeholder="Вставьте JSON из плагина Figma (Ctrl+V) или перетащите файл сюда..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-600 resize-y"
          />

          {isDragging && (
            <div className="absolute inset-0 bg-blue-950/80 border-2 border-dashed border-blue-400 rounded-xl flex flex-col items-center justify-center gap-2 pointer-events-none text-blue-200">
              <ArrowUpTrayIcon className="w-8 h-8 animate-bounce" />
              <span className="text-sm font-semibold">
                Отпустите файл для загрузки в банк
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            💡 Вставьте JSON фрагмент (Ctrl+V) — картинки и SVG распознаются
            автоматически.
          </span>
          {value && <span>Размер: {(value.length / 1024).toFixed(1)} КБ</span>}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
            ⚠️ {error}
          </p>
        )}
      </div>

      {/* Модалка картинок */}
      <ModalFigmaImageCrop
        isOpen={isImagesModalOpen}
        setIsOpen={setIsImagesModalOpen}
        rawImages={images}
        onSaveNodes={saveImagesToTree}
      />

      {/* Модалка SVG */}
      <ModalFigmaSvgBatch
        isOpen={isSvgModalOpen}
        setIsOpen={setIsSvgModalOpen}
        rawSvgs={svgs}
        onSaveNodes={saveSvgsToTree}
      />

      {/* Модальное окно названия фрагмента */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-zinc-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <FolderIcon className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-zinc-100">
                  Сохранение нового фрагмента
                </h3>
                <p className="text-xs text-zinc-400">
                  Пожалуйста, задайте название для сохранения этого JSON
                  фрагмента в базе IndexedDB.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="fragment-name-input"
                  className="text-xs font-semibold text-zinc-300"
                >
                  Название фрагмента <span className="text-red-400">*</span>
                </label>
                <input
                  id="fragment-name-input"
                  ref={inputRef}
                  type="text"
                  value={fragmentName}
                  onChange={(e) => {
                    setFragmentName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Например: Hero секция, Карточка товара, Футер..."
                  className={`w-full bg-zinc-950 border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none transition ${
                    nameError
                      ? "border-red-500 ring-2 ring-red-500/20"
                      : "border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  }`}
                  autoComplete="off"
                />
                {nameError ? (
                  <span className="text-xs text-red-400">{nameError}</span>
                ) : (
                  <span className="text-[11px] text-zinc-500">
                    Пока название не введено, переход к работе с фрагментом
                    заблокирован.
                  </span>
                )}
              </div>

              {pendingJson && (
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex flex-col gap-1 text-[11px] text-zinc-400">
                  <div className="flex justify-between">
                    <span>Размер JSON:</span>
                    <span className="font-mono text-zinc-200">
                      {(pendingJson.length / 1024).toFixed(1)} КБ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Количество символов:</span>
                    <span className="font-mono text-zinc-200">
                      {pendingJson.length.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleCancelModal}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !fragmentName.trim()}
                  className="px-5 py-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium transition cursor-pointer disabled:cursor-not-allowed shadow-md shadow-blue-900/30 flex items-center gap-1.5"
                >
                  {isSaving ? "Сохранение..." : "Сохранить в базу"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
