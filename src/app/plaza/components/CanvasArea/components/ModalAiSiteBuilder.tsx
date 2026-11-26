"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ButtonClose from "@/components/ButtonClose";
import { generateAiSiteAction } from "@/actions/generateAiSiteAction";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

interface ModalAiSiteBuilderProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const PRESET_CHIPS = [
  { label: "💈 Барбершоп", prompt: "Стильный брутальный лендинг для барбершопа: классические стрижки, моделирование бороды, цены, мастера, отзывы клиентов и форма онлайн-записи." },
  { label: "🏋️ Фитнес-клуб", prompt: "Современный лендинг фитнес-клуба премиум класса: направления тренировок, тарифные планы с табами, тренерский состав, частые вопросы и заявка на пробное занятие." },
  { label: "☕ Кофейня", prompt: "Уютный сайт кофейни и обжарочной: авторские напитки, свежая выпечка, сорта зерна, атмосфера, отзывы гостей и заказ столика." },
  { label: "💻 SaaS / IT", prompt: "Высококонверсионный лендинг для B2B SaaS платформы автоматизации: ключевые возможности, тарифы (Start, Pro, Enterprise), отзывы клиентов, FAQ и демо-доступ." },
  { label: "🚗 Автосервис", prompt: "Надежный лендинг автосервиса и детейлинг-центра: перечень услуг, цены на ТО, гарантии, отзывы автовладельцев и запись на диагностику." },
];

const THEME_OPTIONS = [
  { id: "emerald", name: "🌿 Изумрудный эко", desc: "Свежая палитра: мятный фон, изумрудный акцент #10b981 и темная хвоя" },
  { id: "dark", name: "🌙 Тёмный премиум", desc: "Глубокий тёмный фон #090d16 с золотисто-янтарным акцентом #f59e0b" },
  { id: "light-blue", name: "💎 Светлый деловой", desc: "Белоснежный чистый фон, графитовый текст и сапфировый акцент #2563eb" },
  { id: "purple", name: "⚡ Неоновый фиолетовый", desc: "Тёмный стиль #09090b с фиолетовым неоном #8b5cf6" },
  { id: "warm-orange", name: "🍂 Тёплый крафт", desc: "Тёплый фон, кофейные заголовки и терракотовый акцент #ea580c" },
  { id: "auto", name: "✨ Авто (по смыслу)", desc: "AI автоматически подберёт цвета под тематику вашего бизнеса" },
];

export default function ModalAiSiteBuilder({
  isOpen,
  setIsOpen,
}: ModalAiSiteBuilderProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("emerald");
  const [clearCanvasFirst, setClearCanvasFirst] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stepText, setStepText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setError(null);
    } else {
      document.body.style.overflow = "unset";
      setLoading(false);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setError("Пожалуйста, опишите сайт или выберите один из готовых шаблонов выше.");
      return;
    }

    setLoading(true);
    setError(null);
    setStepText("🧠 Проектирую структуру и цветовую палитру...");

    const stepTimer1 = setTimeout(() => {
      setStepText("✍️ Генерирую заголовки, описания и контент...");
    }, 1200);

    const stepTimer2 = setTimeout(() => {
      setStepText("🎨 Стилизую модули, кнопки, фоны и шрифты...");
    }, 2400);

    try {
      const res = await generateAiSiteAction({
        prompt: cleanPrompt,
        themeStyle: selectedTheme,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!res.success || !res.nodes) {
        setError(res.error || "Не удалось сгенерировать сайт. Попробуйте снова.");
        setLoading(false);
        return;
      }

      setStepText("🚀 Вставляю готовый сайт на холст...");

      if (clearCanvasFirst) {
        await useCanvasStore.getState().clearCanvasTree();
      }

      await useCanvasStore.getState().appendRawNodes(res.nodes);

      setLoading(false);
      setIsOpen(false);
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setError(err?.message || "Произошла ошибка при сборке.");
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🪄</span>
                <div>
                  <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    AI Сборщик сайтов из модулей
                    <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      Auto-Assembly
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Опишите проект — выберите цветовую палитру и получите готовый интерактивный лендинг
                  </p>
                </div>
              </div>
              <ButtonClose setClose={setIsOpen} />
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              {/* Preset Quick Chips */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Быстрые шаблоны:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setPrompt(chip.prompt)}
                      className="px-2.5 py-1 text-xs rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex justify-between">
                  <span>Описание сайта (промпт):</span>
                  <span className="text-zinc-500 text-[11px]">Пишите подробно</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                  rows={4}
                  placeholder="Например: Лендинг для частной стоматологии. Услуги (лечение, имплантация, отбеливание), тарифы в табах, врачи, блок часто задаваемых вопросов и форма записи на бесплатный осмотр..."
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700/80 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-all disabled:opacity-50"
                />
              </div>

              {/* Theme Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Выберите стиль и цветовую палитру:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {THEME_OPTIONS.map((theme) => {
                    const isSelected = selectedTheme === theme.id;
                    return (
                      <div
                        key={theme.id}
                        onClick={() => setSelectedTheme(theme.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-950/60 border-indigo-400 text-zinc-100 shadow-[0_0_10px_rgba(99,102,241,0.2)] ring-1 ring-indigo-400"
                            : "bg-zinc-950/40 border-zinc-800 hover:border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <div className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                          <span>{theme.name}</span>
                          {isSelected && <span className="text-indigo-400 text-xs">✓</span>}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                          {theme.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Options */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={clearCanvasFirst}
                    onChange={(e) => setClearCanvasFirst(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-indigo-600 focus:ring-indigo-500 size-4"
                  />
                  <span className="text-xs text-zinc-300">
                    Очистить холст перед генерацией (иначе добавить в конец)
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-lg text-xs text-red-300 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
              <div className="text-xs text-zinc-400">
                {loading ? (
                  <span className="flex items-center gap-2 text-indigo-400 animate-pulse font-mono">
                    <span className="size-2 rounded-full bg-indigo-400 animate-ping" />
                    {stepText}
                  </span>
                ) : (
                  <span>Используются готовые проверенные модули</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGenerate}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-1 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Сборка...
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Собрать сайт</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
