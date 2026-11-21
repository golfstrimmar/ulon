"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import {
  XMarkIcon,
  CheckIcon,
  TrashIcon,
  ArrowsPointingOutIcon,
  BoltIcon,
  ListBulletIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import type { HtmlNode } from "@/types/HtmlNode";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import {
  collectAllDescendantKeys,
  findNodeInTree,
  removeNodesByKeys,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { getGlobalScss, saveGlobalScss } from "@/lib/htmlStorage";
import { updateClassInGlobalScss } from "@/lib/scssCompiler";
import { getColorVariables } from "@/lib/figmaColorStorage";
import { buildColorMap } from "@/app/design/models/figmaTextNode.model";
import {
  compileWireframeBoxesToTree,
  buildWireframeBoxesFromTree,
  countFigmaNodesInTree,
  applySectionClassAndExtractScss,
  isImageWrapperNode,
  type ListDirection,
  type ListItemPreset,
  type OverlayMetrics,
  type WireframeBox,
} from "@/app/plaza/components/PreviewArea/models/wireframeTreeCompiler";
import {
  prepareAiLayoutInput,
  buildWireframeBoxesFromAiPlan,
} from "@/app/plaza/components/PreviewArea/models/wireframeAiBuilder";
import { generateWireframeLayoutAction } from "@/actions/generateWireframeLayoutAction";
import WireframeListPresetsModal, {
  LIST_DIRECTION_OPTIONS,
  LIST_PRESET_OPTIONS,
} from "./WireframeListPresetsModal";

interface TracingWireframeOverlayProps {
  isActive: boolean;
  onClose: () => void;
  viewportWidth: number | string;
  viewportHeight: number;
  boxes: WireframeBox[];
  setBoxes: React.Dispatch<React.SetStateAction<WireframeBox[]>>;
  selectedBoxId: string | null;
  setSelectedBoxId: React.Dispatch<React.SetStateAction<string | null>>;
  overlayMetrics?: OverlayMetrics;
}

const SNAP_GRID = 8;
const AVAILABLE_TAGS = [
  "",
  "section",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "p",
  "span",
  "a",
  "button",
  "is",
  "ul",
  "li",
  "i",
  "fieldset",
] as const;

export default function TracingWireframeOverlay({
  isActive,
  onClose,
  viewportWidth,
  viewportHeight,
  boxes,
  setBoxes,
  selectedBoxId,
  setSelectedBoxId,
  overlayMetrics,
}: TracingWireframeOverlayProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [useSnap, setUseSnap] = useState(true);
  const [figmaScaleMode, setFigmaScaleMode] = useState<"auto" | "1x" | "2x">(
    "auto",
  );
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isAiTracing, setIsAiTracing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Модалка запроса класса секции перед коммитом
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [sectionClassInput, setSectionClassInput] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const classInputRef = useRef<HTMLInputElement>(null);

  const [currentBox, setCurrentBox] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentJson = useCanvasStore((s) => s.currentJson);
  const armedDonorKey = useCanvasStore((s) => s.armedDonorKey);
  const setArmedDonorKey = useCanvasStore((s) => s.setArmedDonorKey);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isClassModalOpen) {
      setTimeout(() => {
        classInputRef.current?.focus();
      }, 40);
    }
  }, [isClassModalOpen]);

  const figmaNodesCount = useMemo(
    () => countFigmaNodesInTree(currentJson),
    [currentJson],
  );

  const donorNodeByKey = useMemo(() => {
    const map = new Map<string, HtmlNode>();
    for (const box of boxes) {
      if (box.donorKey) {
        const found = findNodeInTree(currentJson, box.donorKey);
        if (found) map.set(box.donorKey, found);
      }
    }
    return map;
  }, [boxes, currentJson]);

  const ulBoxes = useMemo(() => {
    return boxes.filter((box) => {
      const donor = box.donorKey ? donorNodeByKey.get(box.donorKey) : null;
      const effectiveTag = (box.tag || donor?.tag || "").trim().toLowerCase();
      return effectiveTag === "ul";
    });
  }, [boxes, donorNodeByKey]);

  const configuredUlCount = useMemo(
    () =>
      ulBoxes.filter(
        (b) =>
          (b.listItemPreset && b.listItemPreset !== "none") ||
          (b.listDirection && b.listDirection !== "auto"),
      ).length,
    [ulBoxes],
  );

  const snap = useCallback(
    (val: number) =>
      useSnap ? Math.round(val / SNAP_GRID) * SNAP_GRID : Math.round(val),
    [useSnap],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isClassModalOpen || isListModalOpen) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-wireframe-ui]")) return;

    const container = containerRef.current;
    if (!container) return;

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore if pointer capture is unsupported
    }

    const rect = container.getBoundingClientRect();
    const x = snap(e.clientX - rect.left);
    const y = snap(e.clientY - rect.top);

    setIsDrawing(true);
    setCurrentBox({ startX: x, startY: y, curX: x, curY: y });
    setSelectedBoxId(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !currentBox || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const curX = snap(e.clientX - rect.left);
    const curY = snap(e.clientY - rect.top);

    setCurrentBox((prev) => (prev ? { ...prev, curX, curY } : null));
  };

  const finishDrawing = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e) {
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }

    if (!isDrawing || !currentBox) return;
    setIsDrawing(false);

    const x = Math.min(currentBox.startX, currentBox.curX);
    const y = Math.min(currentBox.startY, currentBox.curY);
    const width = Math.abs(currentBox.curX - currentBox.startX);
    const height = Math.abs(currentBox.curY - currentBox.startY);

    setCurrentBox(null);

    if (width >= 16 && height >= 16) {
      const currentArmed = useCanvasStore.getState().armedDonorKey;
      const newBox: WireframeBox = {
        id: `box_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        x,
        y,
        width,
        height,
        tag: "",
        donorKey: currentArmed || undefined,
      };
      if (currentArmed) {
        setArmedDonorKey(null);
      }
      setBoxes((prev) => [...prev, newBox]);
      setSelectedBoxId(newBox.id);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    setIsDrawing(false);
    setCurrentBox(null);
  };

  const collectExistingDonorKeys = useCallback(() => {
    const existingDonorKeys = new Set<string>();
    for (const b of boxes) {
      if (b.donorKey) existingDonorKeys.add(b.donorKey);
      if (b.consumedDonorKeys) {
        for (const ck of b.consumedDonorKeys) existingDonorKeys.add(ck);
      }
    }
    return existingDonorKeys;
  }, [boxes]);

  const handleAutoTraceFigma = () => {
    const containerWidth =
      containerRef.current?.clientWidth ||
      (typeof viewportWidth === "number" ? viewportWidth : 1440);

    const autoBoxes = buildWireframeBoxesFromTree(currentJson, {
      containerWidth,
      overlayMetrics,
      scaleMode: figmaScaleMode,
      existingDonorKeys: collectExistingDonorKeys(),
    });

    if (autoBoxes.length === 0) return;

    setBoxes((prev) => [...prev, ...autoBoxes]);
    setSelectedBoxId(autoBoxes[0].id);
  };

  const handleAiTraceFigma = async () => {
    if (isAiTracing) return;

    const containerWidth =
      containerRef.current?.clientWidth ||
      (typeof viewportWidth === "number" ? viewportWidth : 1440);
    const existingDonorKeys = collectExistingDonorKeys();

    const aiNodes = prepareAiLayoutInput(currentJson, {
      containerWidth,
      overlayMetrics,
      scaleMode: figmaScaleMode,
      existingDonorKeys,
    });

    if (aiNodes.length === 0) return;

    const store = useCanvasStore.getState();
    setIsAiTracing(true);
    try {
      const res = await generateWireframeLayoutAction({
        nodes: aiNodes,
        containerWidth,
      });

      if (!res.success || !res.groups || res.groups.length === 0) {
        store.showHud(
          res.error || "AI не смог разобрать структуру секции",
          "warning",
        );
        return;
      }

      const aiBoxes = buildWireframeBoxesFromAiPlan(currentJson, res.groups, {
        containerWidth,
        overlayMetrics,
        scaleMode: figmaScaleMode,
        existingDonorKeys,
      });

      if (aiBoxes.length === 0) return;

      setBoxes((prev) => [...prev, ...aiBoxes]);
      setSelectedBoxId(aiBoxes[0].id);
      store.showHud(
        `AI разметил ${aiBoxes.length} блоков (включая списки)`,
        "success",
      );
    } catch (err: any) {
      console.error("[TracingWireframeOverlay] AI Trace error:", err);
      store.showHud(err?.message || "Ошибка AI разметки", "warning");
    } finally {
      setIsAiTracing(false);
    }
  };

  const deleteBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  const updateBoxTag = (id: string, tag: string) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              tag,
              listItemPreset: tag === "ul" ? b.listItemPreset : undefined,
              listDirection: tag === "ul" ? b.listDirection : undefined,
            }
          : b,
      ),
    );
  };

  const updateBoxListPreset = (id: string, preset: ListItemPreset) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, listItemPreset: preset === "none" ? undefined : preset }
          : b,
      ),
    );
  };

  const applyListPresetToAll = (preset: ListItemPreset) => {
    const ulIds = new Set(ulBoxes.map((b) => b.id));
    setBoxes((prev) =>
      prev.map((b) =>
        ulIds.has(b.id)
          ? { ...b, listItemPreset: preset === "none" ? undefined : preset }
          : b,
      ),
    );
  };

  const updateBoxListDirection = (id: string, direction: ListDirection) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              listDirection: direction === "auto" ? undefined : direction,
            }
          : b,
      ),
    );
  };

  const applyListDirectionToAll = (direction: ListDirection) => {
    const ulIds = new Set(ulBoxes.map((b) => b.id));
    setBoxes((prev) =>
      prev.map((b) =>
        ulIds.has(b.id)
          ? {
              ...b,
              listDirection: direction === "auto" ? undefined : direction,
            }
          : b,
      ),
    );
  };

  const toggleBoxFlex = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const currentStyle = b.style || "";
        const hasFlex = /display\s*:\s*flex/i.test(currentStyle);
        if (hasFlex) {
          const cleaned = currentStyle
            .replace(/display\s*:\s*flex\s*;?/gi, "")
            .replace(/flex-direction\s*:\s*row\s*;?/gi, "")
            .replace(/align-items\s*:\s*[^;]+;?/gi, "")
            .replace(/gap\s*:\s*[^;]+;?/gi, "")
            .trim();
          return { ...b, style: cleaned || undefined };
        }
        const prefix = currentStyle
          ? `${currentStyle.replace(/;?$/, ";")} `
          : "";
        return {
          ...b,
          tag: b.tag || "div",
          style:
            `${prefix}display: flex; flex-direction: row; align-items: flex-start;`.trim(),
        };
      }),
    );
  };

  const detachBoxDonor = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBoxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, donorKey: undefined } : b)),
    );
  };

  const executeCommit = async (sectionClassName: string) => {
    if (boxes.length === 0 || isCommitting) return;
    setIsCommitting(true);

    try {
      const store = useCanvasStore.getState();
      const currentTree = store.currentJson;

      const usedDonorKeys = new Set<string>();
      const donorMap = new Map<string, HtmlNode>();

      for (const box of boxes) {
        if (box.donorKey) {
          const donorNode = findNodeInTree(currentTree, box.donorKey);
          if (donorNode) {
            donorMap.set(box.donorKey, donorNode);
            usedDonorKeys.add(box.donorKey);
          }
        }
        if (box.consumedDonorKeys) {
          for (const ck of box.consumedDonorKeys) {
            usedDonorKeys.add(ck);
          }
        }
      }

      let generatedNodes = compileWireframeBoxesToTree(boxes, donorMap);

      if (generatedNodes.length === 0) {
        store.showHud("Compilation produced empty tree — aborted.", "warning");
        setIsCommitting(false);
        return;
      }

      let generatedClassesCount = 0;

      if (sectionClassName.trim()) {
        const colorVars = await getColorVariables().catch(() => []);
        const colorMap = buildColorMap(colorVars || []);

        const { nodes: bemNodes, classStylesMap } =
          applySectionClassAndExtractScss(
            generatedNodes,
            sectionClassName,
            colorMap,
          );
        generatedNodes = bemNodes;
        generatedClassesCount = classStylesMap.size;

        if (classStylesMap.size > 0) {
          let currentScss = (await getGlobalScss().catch(() => "")) || "";

          if (colorVars.length > 0 && !currentScss.includes("$color-")) {
            currentScss = `${colorVars.join("\n")}\n\n${currentScss}`;
          }

          for (const [cls, scssProps] of classStylesMap.entries()) {
            const fullSnippet = `.${cls} {\n${scssProps}\n}`;
            currentScss = updateClassInGlobalScss(
              currentScss,
              cls,
              fullSnippet,
            );
          }

          await saveGlobalScss(currentScss);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("plaza-styles-updated", { detail: currentScss }),
            );
          }
        }
      }

      const treeWithoutDonors =
        usedDonorKeys.size > 0
          ? removeNodesByKeys(currentTree, usedDonorKeys)
          : currentTree;

      const nextTree = [...treeWithoutDonors, ...generatedNodes];

      if (store.isSplit) {
        const newKeys: string[] = [];
        for (const node of generatedNodes) {
          newKeys.push(...collectAllDescendantKeys(node));
        }
        store.setRightKeys((prev) => {
          const next = new Set(prev);
          usedDonorKeys.forEach((k) => next.delete(k));
          newKeys.forEach((k) => next.add(k));
          return next;
        });
        store.showHud(
          `Created ${boxes.length} frame(s)${
            generatedClassesCount > 0
              ? ` + ${generatedClassesCount} SCSS class(es)`
              : ""
          } in Template Pane 2!`,
          "success",
        );
      } else {
        store.showHud(
          `Created ${boxes.length} frame(s)${
            generatedClassesCount > 0
              ? ` + ${generatedClassesCount} SCSS class(es)`
              : ""
          } on Canvas!`,
          "success",
        );
      }

      setArmedDonorKey(null);
      setIsListModalOpen(false);
      setBoxes([]);
      setSelectedBoxId(null);
      setIsClassModalOpen(false);
      setSectionClassInput("");
      await store.persist(nextTree);
      onClose();
    } catch (err) {
      console.error("[TracingWireframeOverlay] Commit error:", err);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleOpenCommitModal = () => {
    if (boxes.length === 0) return;
    setIsListModalOpen(false);
    setSectionClassInput("");
    setIsClassModalOpen(true);
  };

  if (!isActive) return null;

  const classModal =
    isClassModalOpen && mounted
      ? createPortal(
          <div
            data-wireframe-ui="true"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-default"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!sectionClassInput.trim()) return;
                executeCommit(sectionClassInput);
              }}
              className="w-full max-w-md bg-zinc-900 border border-cyan-500/50 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-zinc-100"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-white font-mono">
                  Класс секции (БЭМ-блок)
                </h3>
                <p className="text-xs text-zinc-400">
                  Сгенерирует БЭМ-классы для всей структуры (как{" "}
                  <code className="text-cyan-300">-- class</code>) и сохранит
                  все{" "}
                  <code className="text-fuchsia-300">flex / border / bg</code>{" "}
                  стили в общий файл стилей под эти классы.
                </p>
              </div>

              {ulBoxes.length > 0 && (
                <div className="px-3 py-2 rounded-xl bg-teal-950/35 border border-teal-500/40 flex items-center justify-between gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-teal-300">
                      Списков &lt;ul&gt;: {ulBoxes.length}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {configuredUlCount > 0
                        ? `Настроено: ${configuredUlCount} из ${ulBoxes.length}`
                        : "Можно задать направление и состав <li>"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsClassModalOpen(false);
                      setIsListModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 border border-teal-400/60 text-teal-200 font-mono font-bold text-[11px] transition cursor-pointer shrink-0"
                  >
                    Настроить &lt;ul&gt;
                  </button>
                </div>
              )}

              <input
                ref={classInputRef}
                type="text"
                value={sectionClassInput}
                onChange={(e) => setSectionClassInput(e.target.value)}
                placeholder="Например: expert, hero, reviews, footer..."
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm font-mono text-white outline-none"
                autoComplete="off"
              />

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  disabled={isCommitting}
                  onClick={() => executeCommit("")}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                  title="Сохранить ноды без генерации БЭМ-классов"
                >
                  Без класса
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isCommitting}
                    onClick={() => setIsClassModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!sectionClassInput.trim() || isCommitting}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition cursor-pointer"
                  >
                    {isCommitting ? "Сохранение..." : "Создать + Стили"}
                  </button>
                </div>
              </div>
            </form>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrawing}
      onPointerCancel={handlePointerCancel}
      className="absolute inset-0 z-40 select-none cursor-crosshair overflow-hidden bg-black/40 backdrop-blur-[1px]"
      style={{
        width: viewportWidth,
        minWidth: viewportWidth,
        height: viewportHeight,
        minHeight: viewportHeight,
      }}
    >
      {/* Панель Tracing */}
      <div
        data-wireframe-ui="true"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 px-3 rounded-xl bg-zinc-950/90 border border-cyan-500/50 shadow-2xl backdrop-blur-md cursor-default text-xs font-mono"
      >
        <span className="text-cyan-400 font-bold flex items-center gap-1.5">
          <ArrowsPointingOutIcon className="w-4 h-4" />
          <span>Tracing Mode</span>
        </span>

        <span className="w-px h-3.5 bg-zinc-800" />

        <button
          type="button"
          onClick={() => setUseSnap(!useSnap)}
          className={`px-2 py-0.5 rounded border transition ${
            useSnap
              ? "bg-cyan-950/80 border-cyan-500/70 text-cyan-300 font-bold"
              : "bg-zinc-800 border-zinc-700 text-zinc-400"
          }`}
        >
          {useSnap ? "Snap 8px: ON" : "Snap: OFF"}
        </button>

        {figmaNodesCount > 0 && (
          <>
            <span className="w-px h-3.5 bg-zinc-800" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAutoTraceFigma}
                disabled={isAiTracing}
                className="px-2.5 py-0.5 rounded bg-emerald-600/25 hover:bg-emerald-600/40 disabled:opacity-40 text-emerald-300 border border-emerald-500/60 font-bold flex items-center gap-1 transition cursor-pointer"
                title="Быстрая геометрическая разметка из Figma"
              >
                <BoltIcon className="w-3.5 h-3.5" />
                <span>Auto Figma ({figmaNodesCount})</span>
              </button>

              <button
                type="button"
                onClick={handleAiTraceFigma}
                disabled={isAiTracing}
                className="px-2.5 py-0.5 rounded bg-violet-600/30 hover:bg-violet-600/50 disabled:opacity-50 text-violet-200 border border-violet-400/70 font-bold flex items-center gap-1 transition cursor-pointer shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                title="Умная смысловая разметка через Gemini AI (распознаёт разнородные карточки, списки и колонки)"
              >
                <SparklesIcon
                  className={`w-3.5 h-3.5 ${isAiTracing ? "animate-spin" : ""}`}
                />
                <span>{isAiTracing ? "AI думает..." : "AI Auto"}</span>
              </button>

              <select
                value={figmaScaleMode}
                onChange={(e) =>
                  setFigmaScaleMode(e.target.value as "auto" | "1x" | "2x")
                }
                className="bg-zinc-900 text-zinc-300 border border-zinc-700 rounded px-1 py-0.5 text-[10px] outline-none cursor-pointer"
                title="Figma overlay scale"
              >
                <option value="auto">Auto</option>
                <option value="1x">1x</option>
                <option value="2x">2x</option>
              </select>
            </div>
          </>
        )}

        {ulBoxes.length > 0 && (
          <>
            <span className="w-px h-3.5 bg-zinc-800" />
            <button
              type="button"
              onClick={() => setIsListModalOpen(true)}
              className={`px-2.5 py-0.5 rounded border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                configuredUlCount > 0
                  ? "bg-teal-950/90 border-teal-400 text-teal-200"
                  : "bg-teal-950/60 border-teal-400/70 text-teal-300 hover:border-teal-300 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.3)]"
              }`}
              title="Настроить направление и состав (a / i / span) для найденных <ul> списков"
            >
              <ListBulletIcon className="w-3.5 h-3.5" />
              <span>
                Списки ({ulBoxes.length})
                {configuredUlCount > 0 ? ` · ${configuredUlCount}✓` : ""}
              </span>
            </button>
          </>
        )}

        <span className="w-px h-3.5 bg-zinc-800" />

        <span className="text-zinc-400">{boxes.length} box(es)</span>

        {boxes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsListModalOpen(false);
              setBoxes([]);
              setSelectedBoxId(null);
            }}
            className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition"
            title="Clear all"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}

        <span className="w-px h-3.5 bg-zinc-800" />

        <button
          type="button"
          disabled={boxes.length === 0}
          onClick={handleOpenCommitModal}
          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-lg transition shadow-md shadow-cyan-950 flex items-center gap-1 cursor-pointer"
        >
          <CheckIcon className="w-4 h-4" />
          <span>Commit to Canvas</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsListModalOpen(false);
            setArmedDonorKey(null);
            onClose();
          }}
          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
          title="Exit"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Модалка настройки направления и состава ul -> li (в Portal поверх всего) */}
      <WireframeListPresetsModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        ulBoxes={ulBoxes}
        allBoxes={boxes}
        donorNodeByKey={donorNodeByKey}
        onUpdatePreset={updateBoxListPreset}
        onApplyToAll={applyListPresetToAll}
        onUpdateDirection={updateBoxListDirection}
        onApplyDirectionToAll={applyListDirectionToAll}
        onFocusBox={(boxId) => setSelectedBoxId(boxId)}
        onProceedToCommit={handleOpenCommitModal}
      />

      {classModal}

      {/* Рисуемая рамка в моменте */}
      {currentBox &&
        (() => {
          const curLeft = Math.min(currentBox.startX, currentBox.curX);
          const curTop = Math.min(currentBox.startY, currentBox.curY);
          const curW = Math.abs(currentBox.curX - currentBox.startX);
          const curH = Math.abs(currentBox.curY - currentBox.startY);

          return (
            <div
              className="absolute border-2 border-dashed border-cyan-400 bg-cyan-500/15 pointer-events-none z-30"
              style={{
                left: curLeft,
                top: curTop,
                width: curW,
                height: curH,
              }}
            >
              {curW >= 4 && (
                <div
                  style={{
                    position: "absolute",
                    top: curTop < 24 ? 4 : -22,
                    left: "50%",
                    transform: "translateX(-50%)",
                    pointerEvents: "none",
                  }}
                  className="px-1.5 py-0.5 bg-zinc-950/90 text-cyan-300 border border-cyan-500/60 rounded text-[10px] font-mono font-medium shadow-md leading-none whitespace-nowrap"
                >
                  {Math.round(curW)}px
                </div>
              )}

              {curH >= 4 && (
                <div
                  style={{
                    position: "absolute",
                    left: curLeft < 44 ? 4 : -6,
                    top: "50%",
                    transform:
                      curLeft < 44
                        ? "translateY(-50%)"
                        : "translate(-100%, -50%)",
                    pointerEvents: "none",
                  }}
                  className="px-1.5 py-0.5 bg-zinc-950/90 text-cyan-300 border border-cyan-500/60 rounded text-[10px] font-mono font-medium shadow-md leading-none whitespace-nowrap"
                >
                  {Math.round(curH)}px
                </div>
              )}
            </div>
          );
        })()}

      {/* Нарисованные коробки */}
      {boxes.map((box) => {
        const isSelected = box.id === selectedBoxId;
        const donor = box.donorKey ? donorNodeByKey.get(box.donorKey) : null;
        const effectiveTag = box.tag || donor?.tag || "";
        const isUlBox = effectiveTag.toLowerCase() === "ul";

        const activePreset = box.listItemPreset || "none";
        const presetMeta =
          activePreset !== "none"
            ? LIST_PRESET_OPTIONS.find((p) => p.value === activePreset)
            : null;

        const activeDir = box.listDirection || "auto";
        const dirMeta =
          activeDir !== "auto"
            ? LIST_DIRECTION_OPTIONS.find((d) => d.value === activeDir)
            : null;

        const isFlexBox = Boolean(
          box.style && /display\s*:\s*flex/i.test(box.style),
        );
        const donorLabel = donor
          ? donor.text?.trim() ||
            (donor.tag === "img" || isImageWrapperNode(donor)
              ? "[img]"
              : `<${donor.tag}>`)
          : "";

        return (
          <div
            key={box.id}
            onClick={(e) => {
              e.stopPropagation();
              if (armedDonorKey) {
                setBoxes((prev) =>
                  prev.map((b) =>
                    b.id === box.id ? { ...b, donorKey: armedDonorKey } : b,
                  ),
                );
                setArmedDonorKey(null);
              }
              setSelectedBoxId(box.id);
            }}
            className={`group absolute border-2 transition-all cursor-pointer ${
              isSelected
                ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.4)] z-30"
                : isUlBox
                  ? "border-teal-400/80 bg-teal-500/10 hover:border-teal-300 z-20"
                  : isFlexBox
                    ? "border-fuchsia-400/80 bg-fuchsia-500/10 hover:border-fuchsia-300 z-20"
                    : donor
                      ? "border-amber-400/80 bg-amber-500/10 hover:border-amber-300 z-20"
                      : "border-cyan-500/60 bg-cyan-950/20 hover:border-cyan-400/90 z-20"
            }`}
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
            }}
          >
            {/* Бейдж ширины сверху */}
            <div
              style={{
                position: "absolute",
                top: box.y < 24 ? 4 : -22,
                left: "50%",
                transform: "translateX(-50%)",
                pointerEvents: "none",
              }}
              className={`px-1.5 py-0.5 bg-zinc-950/90 text-cyan-300 border border-cyan-500/60 rounded text-[10px] font-mono font-medium shadow-md leading-none whitespace-nowrap z-30 transition-opacity ${
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {Math.round(box.width)}px
            </div>

            {/* Бейдж высоты слева */}
            <div
              style={{
                position: "absolute",
                left: box.x < 44 ? 4 : -6,
                top: "50%",
                transform:
                  box.x < 44 ? "translateY(-50%)" : "translate(-100%, -50%)",
                pointerEvents: "none",
              }}
              className={`px-1.5 py-0.5 bg-zinc-950/90 text-cyan-300 border border-cyan-500/60 rounded text-[10px] font-mono font-medium shadow-md leading-none whitespace-nowrap z-30 transition-opacity ${
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {Math.round(box.height)}px
            </div>

            {/* Компактные бейджи */}
            <div className="absolute top-0.5 left-0.5 right-0.5 flex items-center gap-1 font-mono text-[10px] overflow-hidden pointer-events-none">
              <span
                className={`px-1 py-0.5 rounded font-bold border shrink-0 leading-none ${
                  isUlBox
                    ? "bg-teal-950/90 border-teal-500 text-teal-200"
                    : effectiveTag
                      ? "bg-indigo-950/90 border-indigo-500/80 text-indigo-300"
                      : "bg-zinc-900/85 border-dashed border-zinc-500 text-zinc-400"
                }`}
              >
                {effectiveTag || "empty"}
              </span>

              {dirMeta && (
                <span className="px-1 py-0.5 rounded font-bold bg-cyan-900/90 border border-cyan-400/70 text-cyan-100 shrink-0 leading-none">
                  {dirMeta.icon}
                </span>
              )}

              {presetMeta && (
                <span className="px-1 py-0.5 rounded font-bold bg-teal-900/90 border border-teal-400/70 text-teal-100 shrink-0 leading-none">
                  {presetMeta.title}
                </span>
              )}

              {isFlexBox && (
                <span
                  className={`px-1 py-0.5 rounded font-bold bg-fuchsia-950/90 border border-fuchsia-500/70 text-fuchsia-300 shrink-0 leading-none transition-opacity ${
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  flex
                </span>
              )}

              {donor && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/70 text-amber-200 truncate max-w-full leading-none pointer-events-auto transition-opacity ${
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <span className="truncate font-sans">{donorLabel}</span>
                  <button
                    type="button"
                    data-wireframe-ui="true"
                    onClick={(e) => detachBoxDonor(box.id, e)}
                    className="text-amber-300 hover:text-white font-bold shrink-0 cursor-pointer"
                    title="Detach donor"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>

            {/* ПАНЕЛЬ ВЫБОРА ТЕГА */}
            {isSelected && (
              <div
                data-wireframe-ui="true"
                className="absolute top-full left-0 flex items-center gap-1 bg-zinc-950 border border-zinc-700 p-0.5 rounded-lg shadow-xl z-40 text-[10px] font-mono"
              >
                {AVAILABLE_TAGS.map((t) => (
                  <button
                    key={t || "empty"}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateBoxTag(box.id, t);
                    }}
                    className={`px-1.5 py-0.5 rounded border transition ${
                      box.tag === t
                        ? "bg-cyan-600 text-white font-bold border-cyan-400"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    {t || "empty"}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={(e) => toggleBoxFlex(box.id, e)}
                  className={`px-1.5 py-0.5 rounded border transition ${
                    isFlexBox
                      ? "bg-fuchsia-600 text-white font-bold border-fuchsia-400"
                      : "bg-zinc-900 text-fuchsia-300 border-zinc-800 hover:bg-zinc-800"
                  }`}
                  title="Toggle display: flex; flex-direction: row"
                >
                  flex
                </button>

                <button
                  type="button"
                  onClick={(e) => deleteBox(box.id, e)}
                  className="px-1 text-red-400 hover:text-white rounded hover:bg-red-900/40 ml-1"
                  title="Delete box"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
