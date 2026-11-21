"use client";

import React, { useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, CheckIcon, EyeIcon } from "@heroicons/react/24/outline";
import type { HtmlNode } from "@/types/HtmlNode";
import type {
  ListDirection,
  ListItemPreset,
  WireframeBox,
} from "@/app/plaza/components/PreviewArea/models/wireframeTreeCompiler";

interface WireframeListPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ulBoxes: WireframeBox[];
  allBoxes: WireframeBox[];
  donorNodeByKey: Map<string, HtmlNode>;
  onUpdatePreset: (boxId: string, preset: ListItemPreset) => void;
  onApplyToAll: (preset: ListItemPreset) => void;
  onUpdateDirection: (boxId: string, direction: ListDirection) => void;
  onApplyDirectionToAll: (direction: ListDirection) => void;
  onFocusBox?: (boxId: string) => void;
  onProceedToCommit?: () => void;
}

interface PresetMeta {
  value: ListItemPreset;
  title: string;
  description: string;
  tags: { tag: string; cls: string }[];
}

interface DirectionMeta {
  value: ListDirection;
  icon: string;
  title: string;
  hint: string;
}

export const LIST_DIRECTION_OPTIONS: DirectionMeta[] = [
  {
    value: "auto",
    icon: "✨",
    title: "Авто",
    hint: "Как определилось",
  },
  {
    value: "row",
    icon: "→",
    title: "Вправо (в строку)",
    hint: "Колонки как <li> слева направо",
  },
  {
    value: "column",
    icon: "↓",
    title: "Вниз (в колонку)",
    hint: "Строки как <li> сверху вниз",
  },
  {
    value: "wrap",
    icon: "⊞",
    title: "Сетка (перенос)",
    hint: "Карточки flex-wrap: wrap",
  },
];

export const LIST_PRESET_OPTIONS: PresetMeta[] = [
  {
    value: "none",
    title: "Обычный",
    description: "Оставить как сгенерировано",
    tags: [
      { tag: "ul", cls: "bg-teal-950 text-teal-300 border-teal-600/70" },
      { tag: "li", cls: "bg-cyan-950 text-cyan-300 border-cyan-600/70" },
    ],
  },
  {
    value: "a",
    title: "Ссылка",
    description: "Без лишнего span",
    tags: [
      { tag: "ul", cls: "bg-teal-950 text-teal-300 border-teal-600/70" },
      { tag: "li", cls: "bg-cyan-950 text-cyan-300 border-cyan-600/70" },
      {
        tag: "a",
        cls: "bg-emerald-950 text-emerald-300 border-emerald-500/70",
      },
    ],
  },
  {
    value: "a-i",
    title: "Ссылка + иконка",
    description: "Текст прямо в a, иконка в i",
    tags: [
      { tag: "ul", cls: "bg-teal-950 text-teal-300 border-teal-600/70" },
      { tag: "li", cls: "bg-cyan-950 text-cyan-300 border-cyan-600/70" },
      {
        tag: "a",
        cls: "bg-emerald-950 text-emerald-300 border-emerald-500/70",
      },
      { tag: "i", cls: "bg-amber-950 text-amber-300 border-amber-500/70" },
    ],
  },
  {
    value: "i-span",
    title: "Иконка + текст",
    description: "Без ссылки (преимущества / пункты)",
    tags: [
      { tag: "ul", cls: "bg-teal-950 text-teal-300 border-teal-600/70" },
      { tag: "li", cls: "bg-cyan-950 text-cyan-300 border-cyan-600/70" },
      { tag: "i", cls: "bg-amber-950 text-amber-300 border-amber-500/70" },
      {
        tag: "span",
        cls: "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-500/70",
      },
    ],
  },
  {
    value: "a-i-span",
    title: "Ссылка + иконка + текст",
    description: "Полная структура меню",
    tags: [
      { tag: "ul", cls: "bg-teal-950 text-teal-300 border-teal-600/70" },
      { tag: "li", cls: "bg-cyan-950 text-cyan-300 border-cyan-600/70" },
      {
        tag: "a",
        cls: "bg-emerald-950 text-emerald-300 border-emerald-500/70",
      },
      { tag: "i", cls: "bg-amber-950 text-amber-300 border-amber-500/70" },
      {
        tag: "span",
        cls: "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-500/70",
      },
    ],
  },
];

function isInsideBox(inner: WireframeBox, outer: WireframeBox): boolean {
  return (
    inner.id !== outer.id &&
    inner.x >= outer.x - 4 &&
    inner.y >= outer.y - 4 &&
    inner.x + inner.width <= outer.x + outer.width + 4 &&
    inner.y + inner.height <= outer.y + outer.height + 4
  );
}

function renderTagChain(tags: { tag: string; cls: string }[]) {
  return (
    <div className="flex items-center flex-wrap gap-1 font-mono text-[10px]">
      {tags.map((item, idx) => {
        const isSiblingSpan =
          item.tag === "span" && idx > 0 && tags[idx - 1].tag === "i";
        return (
          <React.Fragment key={`${item.tag}_${idx}`}>
            {idx > 0 && (
              <span className="text-zinc-500 font-bold">
                {isSiblingSpan ? "+" : "›"}
              </span>
            )}
            <span
              className={`px-1.5 py-0.5 rounded border font-bold leading-none ${item.cls}`}
            >
              &lt;{item.tag}&gt;
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function WireframeListPresetsModal({
  isOpen,
  onClose,
  ulBoxes,
  allBoxes,
  donorNodeByKey,
  onUpdatePreset,
  onApplyToAll,
  onUpdateDirection,
  onApplyDirectionToAll,
  onFocusBox,
  onProceedToCommit,
}: WireframeListPresetsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const listSummaries = useMemo(() => {
    const collectDescendantBoxes = (rootId: string): WireframeBox[] => {
      const result: WireframeBox[] = [];
      const queue = [rootId];
      const visited = new Set<string>([rootId]);

      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const b of allBoxes) {
          if (!visited.has(b.id) && b.parentId === cur) {
            visited.add(b.id);
            result.push(b);
            queue.push(b.id);
          }
        }
      }
      return result;
    };

    const getDonorText = (node?: HtmlNode): string => {
      if (!node) return "";
      if (node.text && node.text.trim()) return node.text.trim();
      if (Array.isArray(node.children)) {
        for (const ch of node.children) {
          const found = getDonorText(ch);
          if (found) return found;
        }
      }
      return "";
    };

    return ulBoxes.map((ulBox) => {
      const directByParent = allBoxes.filter((b) => b.parentId === ulBox.id);
      const directItems =
        directByParent.length > 0
          ? directByParent
          : allBoxes.filter(
              (b) =>
                isInsideBox(b, ulBox) &&
                (b.tag === "li" ||
                  !allBoxes.some(
                    (other) =>
                      other.id !== ulBox.id &&
                      other.id !== b.id &&
                      isInsideBox(other, ulBox) &&
                      isInsideBox(b, other),
                  )),
            );

      const descendants = collectDescendantBoxes(ulBox.id);
      const searchPool = descendants.length > 0 ? descendants : directItems;

      const previews: string[] = [];
      for (const b of searchPool) {
        if (!b.donorKey) continue;
        const txt = getDonorText(donorNodeByKey.get(b.donorKey));
        if (txt && !previews.includes(txt)) {
          previews.push(txt);
          if (previews.length >= 3) break;
        }
      }

      return {
        ulBox,
        itemsCount: directItems.length,
        previews,
      };
    });
  }, [ulBoxes, allBoxes, donorNodeByKey]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      data-wireframe-ui="true"
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-default"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[88vh] bg-zinc-900 border border-teal-500/60 rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-zinc-100"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-teal-950 border border-teal-500/60 text-teal-300 text-xs">
                &lt;ul&gt;
              </span>
              <span>Направление и состав списков ({ulBoxes.length})</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Задайте направление раскладки (вправо / вниз / сетка) и состав
              каждого &lt;li&gt;.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            title="Закрыть"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Применить ко всем спискам сразу (если списков >= 2) */}
        {ulBoxes.length >= 2 && (
          <div className="px-5 py-2.5 bg-zinc-950/50 border-b border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-zinc-400">
                Направление для всех:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {LIST_DIRECTION_OPTIONS.map((dir) => (
                  <button
                    key={dir.value}
                    type="button"
                    onClick={() => onApplyDirectionToAll(dir.value)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-400/60 text-[11px] font-mono text-zinc-200 transition cursor-pointer"
                  >
                    {dir.icon} {dir.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-zinc-400">
                Состав &lt;li&gt; для всех:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {LIST_PRESET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onApplyToAll(opt.value)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-teal-500/60 text-[11px] font-mono text-zinc-200 transition cursor-pointer"
                  >
                    {opt.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Список всех ul-блоков */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
          {listSummaries.length === 0 ? (
            <div className="py-10 text-center text-xs font-mono text-zinc-500">
              В текущем разборе нет ни одного контейнера с тегом &lt;ul&gt;.
            </div>
          ) : (
            listSummaries.map(({ ulBox, itemsCount, previews }, index) => {
              const activePreset: ListItemPreset =
                ulBox.listItemPreset || "none";
              const activeDirection: ListDirection =
                ulBox.listDirection || "auto";

              return (
                <div
                  key={ulBox.id}
                  className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-4 flex flex-col gap-3.5"
                >
                  {/* Заголовок конкретного списка */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-teal-950/90 border border-teal-500/60 text-teal-300 text-xs font-mono font-bold shrink-0">
                        Список #{index + 1}
                      </span>
                      <span className="text-xs font-mono text-zinc-400 shrink-0">
                        {itemsCount > 0 ? `${itemsCount} шт.` : "пустой"} ·{" "}
                        {Math.round(ulBox.width)}×{Math.round(ulBox.height)}px
                      </span>
                      {previews.length > 0 && (
                        <span className="text-xs text-zinc-300 truncate max-w-[320px]">
                          «{previews.join("», «")}»
                        </span>
                      )}
                    </div>

                    {onFocusBox && (
                      <button
                        type="button"
                        onClick={() => {
                          onFocusBox(ulBox.id);
                          onClose();
                        }}
                        className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer shrink-0"
                        title="Выделить этот <ul> на макете"
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                        <span>На макете</span>
                      </button>
                    )}
                  </div>

                  {/* 1. Выбор направления (Авто / Вправо / Вниз / Сетка) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      1. Направление пунктов:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {LIST_DIRECTION_OPTIONS.map((dir) => {
                        const isDirActive = activeDirection === dir.value;
                        return (
                          <button
                            key={dir.value}
                            type="button"
                            onClick={() =>
                              onUpdateDirection(ulBox.id, dir.value)
                            }
                            className={`px-2.5 py-2 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                              isDirActive
                                ? "bg-cyan-950/60 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                                : "bg-zinc-900/70 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-xs font-bold font-mono ${
                                  isDirActive
                                    ? "text-cyan-200"
                                    : "text-zinc-200"
                                }`}
                              >
                                {dir.icon} {dir.title}
                              </span>
                              {isDirActive && (
                                <CheckIcon className="w-3.5 h-3.5 text-cyan-400 stroke-[3] shrink-0" />
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400 leading-tight">
                              {dir.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Выбор состава пунктов (5 наглядных карточек) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      2. Состав каждого &lt;li&gt;:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {LIST_PRESET_OPTIONS.map((opt) => {
                        const isActive = activePreset === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => onUpdatePreset(ulBox.id, opt.value)}
                            className={`p-2.5 rounded-xl border text-left flex flex-col gap-1.5 transition cursor-pointer ${
                              isActive
                                ? "bg-teal-950/50 border-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.2)]"
                                : "bg-zinc-900/70 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  isActive ? "text-teal-200" : "text-zinc-200"
                                }`}
                              >
                                {opt.title}
                              </span>
                              {isActive && (
                                <span className="size-4 rounded-full bg-teal-500 text-zinc-950 flex items-center justify-center shrink-0">
                                  <CheckIcon className="w-3 h-3 stroke-[3]" />
                                </span>
                              )}
                            </div>

                            {renderTagChain(opt.tags)}

                            <span className="text-[10px] text-zinc-400">
                              {opt.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-zinc-950/90 border-t border-zinc-800 flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-zinc-500">
            Направление и состав применятся при Commit to Canvas
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-medium transition cursor-pointer"
            >
              Готово
            </button>
            {onProceedToCommit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onProceedToCommit();
                }}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Перейти к Commit →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
