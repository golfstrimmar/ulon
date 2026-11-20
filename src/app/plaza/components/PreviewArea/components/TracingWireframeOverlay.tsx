"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  XMarkIcon,
  CheckIcon,
  TrashIcon,
  ArrowsPointingOutIcon,
  BoltIcon,
  ChevronDownIcon,
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
  type ListItemPreset,
  type OverlayMetrics,
  type WireframeBox,
} from "@/app/plaza/components/PreviewArea/models/wireframeTreeCompiler";

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

const LIST_ITEM_PRESETS: {
  value: ListItemPreset;
  label: string;
  shortLabel: string;
  hint: string;
}[] = [
  {
    value: "none",
    label: "ul › li",
    shortLabel: "li",
    hint: "как есть",
  },
  {
    value: "a",
    label: "ul › li › a",
    shortLabel: "li › a",
    hint: "ссылка без span",
  },
  {
    value: "a-i",
    label: "ul › li › a › i",
    shortLabel: "li › a › i",
    hint: "ссылка + иконка",
  },
  {
    value: "i-span",
    label: "ul › li › i + span",
    shortLabel: "li › i+span",
    hint: "иконка + текст",
  },
  {
    value: "a-i-span",
    label: "ul › li › a › i + span",
    shortLabel: "li › a › i+span",
    hint: "ссылка + иконка + текст",
  },
];

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
  const [openListPresetBoxId, setOpenListPresetBoxId] = useState<string | null>(
    null,
  );

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
    if (isClassModalOpen) {
      setTimeout(() => {
        classInputRef.current?.focus();
      }, 40);
    }
  }, [isClassModalOpen]);

  useEffect(() => {
    if (!openListPresetBoxId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenListPresetBoxId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openListPresetBoxId]);

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

  const snap = useCallback(
    (val: number) =>
      useSnap ? Math.round(val / SNAP_GRID) * SNAP_GRID : Math.round(val),
    [useSnap],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isClassModalOpen) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-wireframe-ui]")) return;

    setOpenListPresetBoxId(null);

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

  const handleAutoTraceFigma = () => {
    setOpenListPresetBoxId(null);
    const containerWidth =
      containerRef.current?.clientWidth ||
      (typeof viewportWidth === "number" ? viewportWidth : 1440);

    const existingDonorKeys = new Set<string>();
    for (const b of boxes) {
      if (b.donorKey) existingDonorKeys.add(b.donorKey);
      if (b.consumedDonorKeys) {
        for (const ck of b.consumedDonorKeys) existingDonorKeys.add(ck);
      }
    }

    const autoBoxes = buildWireframeBoxesFromTree(currentJson, {
      containerWidth,
      overlayMetrics,
      scaleMode: figmaScaleMode,
      existingDonorKeys,
    });

    if (autoBoxes.length === 0) return;

    setBoxes((prev) => [...prev, ...autoBoxes]);
    setSelectedBoxId(autoBoxes[0].id);
  };

  const deleteBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (openListPresetBoxId === id) setOpenListPresetBoxId(null);
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
    setOpenListPresetBoxId(null);
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
      setOpenListPresetBoxId(null);
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
    setOpenListPresetBoxId(null);
    setSectionClassInput("");
    setIsClassModalOpen(true);
  };

  if (!isActive) return null;

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
                className="px-2.5 py-0.5 rounded bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/60 font-bold flex items-center gap-1 transition cursor-pointer"
                title="Auto-create structured wireframe boxes (rows/flex & stacks) from Figma"
              >
                <BoltIcon className="w-3.5 h-3.5" />
                <span>Auto Figma ({figmaNodesCount})</span>
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

        <span className="w-px h-3.5 bg-zinc-800" />

        <span className="text-zinc-400">{boxes.length} box(es)</span>

        {boxes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setOpenListPresetBoxId(null);
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
            setOpenListPresetBoxId(null);
            setArmedDonorKey(null);
            onClose();
          }}
          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
          title="Exit"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Модалка ввода класса секции и генерации БЭМ + GlobalScss */}
      {isClassModalOpen && (
        <div
          data-wireframe-ui="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 cursor-default"
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
                <code className="text-cyan-300">-- class</code>) и сохранит все{" "}
                <code className="text-fuchsia-300">flex / border / bg</code>{" "}
                стили в общий файл стилей под эти классы.
              </p>
            </div>

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
        </div>
      )}

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
        const isDropdownOpen = openListPresetBoxId === box.id;
        const donor = box.donorKey ? donorNodeByKey.get(box.donorKey) : null;
        const effectiveTag = box.tag || donor?.tag || "";
        const isUlBox = effectiveTag.toLowerCase() === "ul";
        const activeListPreset = box.listItemPreset || "none";
        const hasActivePreset = activeListPreset !== "none";
        const activePresetInfo =
          LIST_ITEM_PRESETS.find((p) => p.value === activeListPreset) ||
          LIST_ITEM_PRESETS[0];

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
              if (openListPresetBoxId && openListPresetBoxId !== box.id) {
                setOpenListPresetBoxId(null);
              }
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
              isDropdownOpen
                ? "z-50 border-cyan-400 bg-cyan-500/15"
                : isSelected
                  ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.4)] z-30"
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

            {/* Верхняя строка бейджей + выпадашка структуры списка для ul */}
            <div className="absolute top-1 left-1 right-1 flex items-center justify-between gap-1 font-mono text-[10px]">
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <span
                  className={`px-1.5 py-0.5 rounded font-bold border shrink-0 ${
                    effectiveTag
                      ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                      : "bg-zinc-900/90 border-dashed border-zinc-500 text-zinc-400"
                  }`}
                >
                  {effectiveTag || "empty"}
                </span>

                {isFlexBox && (
                  <span className="px-1 py-0.5 rounded font-bold bg-fuchsia-950/90 border border-fuchsia-500/70 text-fuchsia-300 shrink-0">
                    flex
                  </span>
                )}

                {donor && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/70 text-amber-200 truncate max-w-full">
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

              {isUlBox && (
                <div className="relative shrink-0" data-wireframe-ui="true">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBoxId(box.id);
                      setOpenListPresetBoxId((prev) =>
                        prev === box.id ? null : box.id,
                      );
                    }}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono transition cursor-pointer shadow-sm ${
                      hasActivePreset
                        ? "bg-emerald-950/95 border-emerald-400 text-emerald-200 font-bold"
                        : "bg-zinc-950/90 border-cyan-400/70 text-cyan-200 hover:border-cyan-300 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                    }`}
                    title="Шаблон структуры для всех <li> в этом списке (можно пропустить)"
                  >
                    <span>
                      {hasActivePreset
                        ? `✦ ${activePresetInfo.shortLabel}`
                        : "✦ шаблон li"}
                    </span>
                    <ChevronDownIcon className="w-2.5 h-2.5 shrink-0" />
                  </button>

                  {isDropdownOpen && (
                    <div
                      data-wireframe-ui="true"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-zinc-950/95 border border-cyan-500/50 shadow-2xl p-1 flex flex-col gap-0.5 z-50 backdrop-blur-md"
                    >
                      <div className="px-2 py-0.5 text-[9px] text-zinc-400 border-b border-zinc-800 mb-0.5">
                        Применить ко всем пунктам списка:
                      </div>
                      {LIST_ITEM_PRESETS.map((preset) => {
                        const isPresetActive =
                          activeListPreset === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() =>
                              updateBoxListPreset(box.id, preset.value)
                            }
                            className={`w-full text-left px-2 py-1 rounded flex items-center justify-between gap-2 transition cursor-pointer ${
                              isPresetActive
                                ? "bg-cyan-600/30 text-cyan-200 border border-cyan-500/60 font-bold"
                                : "text-zinc-300 hover:bg-zinc-800/90 border border-transparent"
                            }`}
                          >
                            <span className="text-[10px] font-mono">
                              {preset.label}
                            </span>
                            <span className="text-[9px] text-zinc-400 font-sans shrink-0">
                              {preset.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
