"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";
import type { HtmlNode } from "@/types/HtmlNode";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

interface SwiperBreakpoint {
  id: string;
  width: number;
  slidesPerView: number | "auto";
  spaceBetween: number;
}

function sanitizeClassName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^\.+/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-");
  return cleaned || "custom-swiper";
}

function buildSwiperNodes(params: {
  sliderClass: string;
  slidesCount: number;
  slidesPerView: number | "auto";
  spaceBetween: number;
  loop: boolean;
  speed: number;
  autoplayEnabled: boolean;
  autoplayDelay: number;
  showNavigation: boolean;
  showPagination: boolean;
  useBreakpoints: boolean;
  breakpoints: SwiperBreakpoint[];
}): HtmlNode[] {
  const cls = sanitizeClassName(params.sliderClass);
  const sectionClass = `${cls}-section`;
  const paginationClass = `${cls}-pagination`;
  const prevClass = `${cls}-prev`;
  const nextClass = `${cls}-next`;
  const bulletClass = `${cls}-bullet`;

  const sortedBreakpoints = params.useBreakpoints
    ? [...params.breakpoints]
        .filter((bp) => bp.width > 0)
        .sort((a, b) => a.width - b.width)
    : [];

  const breakpointsEntries = sortedBreakpoints
    .map((bp) => {
      const spv =
        bp.slidesPerView === "auto" ? "'auto'" : Number(bp.slidesPerView) || 1;
      return `${bp.width}: { slidesPerView: ${spv}, spaceBetween: ${Number(bp.spaceBetween) || 0} }`;
    })
    .join(", ");

  const optionsParts: string[] = [
    `slidesPerView: ${params.slidesPerView === "auto" ? "'auto'" : Number(params.slidesPerView) || 1}`,
    `spaceBetween: ${Number(params.spaceBetween) || 0}`,
    `loop: ${params.loop}`,
    `speed: ${Math.max(0, Number(params.speed) || 0)}`,
  ];

  if (params.autoplayEnabled) {
    optionsParts.push(
      `autoplay: { delay: ${Math.max(100, Number(params.autoplayDelay) || 3000)}, disableOnInteraction: false }`,
    );
  }

  if (params.showNavigation) {
    optionsParts.push(
      `navigation: { nextEl: parentSection.querySelector('.${nextClass}'), prevEl: parentSection.querySelector('.${prevClass}') }`,
    );
  }

  if (params.showPagination) {
    optionsParts.push(
      `pagination: { el: parentSection.querySelector('.${paginationClass}'), clickable: true, bulletClass: '${bulletClass}', bulletActiveClass: 'is-active' }`,
    );
  }

  if (breakpointsEntries) {
    optionsParts.push(`breakpoints: { ${breakpointsEntries} }`);
  }

  optionsParts.push("observer: true", "observeParents: true");

  const initFnName = `init_${cls.replace(/-/g, "_")}`;

  const scriptText = `/* @component: .${cls} */ (function () { function ${initFnName}() { document.querySelectorAll('.${cls}').forEach(function (container) { if (container.swiper) { container.swiper.destroy(true, true); } const parentSection = container.closest('.${sectionClass}') || container.parentElement || container; new Swiper(container, { ${optionsParts.join(", ")} }); }); } let cssLink = document.getElementById('swiper-css'); if (!cssLink) { cssLink = document.createElement('link'); cssLink.id = 'swiper-css'; cssLink.rel = 'stylesheet'; cssLink.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css'; cssLink.addEventListener('load', function () { document.querySelectorAll('.${cls}').forEach(function (c) { if (c.swiper) c.swiper.update(); }); }); document.head.appendChild(cssLink); } if (typeof Swiper !== 'undefined') { ${initFnName}(); } else { let script = document.getElementById('swiper-js'); if (!script) { script = document.createElement('script'); script.id = 'swiper-js'; script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js'; document.head.appendChild(script); } script.addEventListener('load', ${initFnName}); } })(); /* @end: .${cls} */`;

  const slides: HtmlNode[] = Array.from(
    { length: Math.max(1, params.slidesCount) },
    (_, i) => ({
      tag: "div",
      class: `swiper-slide ${cls}__slide`,
      style: "",
      attributes: {},
      children: [
        {
          tag: "div",
          class: `${cls}__card`,
          style:
            "height: 100%; border: 1px solid color-mix(in srgb, var(--slate-500) 78%, transparent); margin: 0 auto;",
          attributes: {},
          children: [
            {
              tag: "h3",
              text: `Slide ${i + 1}`,
              class: "",
              style: "",
              attributes: {},
              children: [],
            },
          ],
        },
      ],
    }),
  );

  const swiperChildren: HtmlNode[] = [
    {
      tag: "div",
      class: "swiper-wrapper",
      style: "",
      attributes: {},
      children: slides,
    },
  ];

  if (params.showPagination) {
    swiperChildren.push({
      tag: "div",
      class: paginationClass,
      style: `display: flex;min-height: 12px; flex-direction: row; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; .${bulletClass} { width: 8px; height: 8px; border-radius: 50%; background: var(--slate-300); opacity: 0.6; cursor: pointer; transition: all 0.3s ease; &.is-active { width: 12px; height: 12px; background: var(--teal-500); opacity: 1; } &:hover:not(.is-active) { opacity: 0.9; } }`,
      attributes: {},
      children: [],
    });
  }

  const sectionChildren: HtmlNode[] = [
    {
      tag: "div",
      class: `${cls} swiper`,
      style: "width: 100%;",
      attributes: {},
      children: swiperChildren,
    },
  ];

  if (params.showNavigation) {
    sectionChildren.push(
      {
        tag: "div",
        class: `${prevClass} swiper-button-prev`,
        style:
          "left: 0; width: 40px !important; height: 40px !important; cursor: pointer; border-radius: 100%; border: none; background: color-mix(in srgb, var(--accent) 13%, transparent); backdrop-filter: blur(8px); color: var(--slate-400); outline: 2px solid transparent; outline-offset: 2px; transition: all 0.2s ease; top: 50%; transform: translate(0%, -50%); &::after { display: none; } &:hover { background: var(--accent); outline-color: var(--accent); color: var(--teal-400); } &:active { background: var(--teal-300); outline-color: var(--accent); color: var(--teal-200); }",
        attributes: {},
        children: [
          {
            tag: "i",
            class: "svg-wrapper",
            style:
              "transition: all 0.2s ease-in-out; display: inline-block; line-height: 0; vertical-align: middle; width: 20px; height: 20px;",
            attributes: {},
            children: [
              {
                tag: "svg",
                class: "",
                style: "",
                attributes: {
                  xmlns: "http://www.w3.org/2000/svg",
                  fill: "none",
                  viewBox: "0 0 24 24",
                  "stroke-width": "1.5",
                  stroke: "currentColor",
                },
                children: [
                  {
                    tag: "path",
                    class: "",
                    style: "",
                    attributes: {
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round",
                      d: "M15.75 19.5 8.25 12l7.5-7.5",
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        tag: "div",
        class: `${nextClass} swiper-button-next`,
        style:
          "right: 0; width: 40px !important; height: 40px !important; cursor: pointer; border-radius: 100%; border: none; background: color-mix(in srgb, var(--accent) 13%, transparent); backdrop-filter: blur(8px); color: var(--slate-400); outline: 2px solid transparent; outline-offset: 2px; transition: all 0.2s ease; top: 50%; transform: translate(0%, -50%); &::after { display: none; } &:hover { background: var(--accent); outline-color: var(--accent); color: var(--teal-400); } &:active { background: var(--teal-300); outline-color: var(--accent); color: var(--teal-200); }",
        attributes: {},
        children: [
          {
            tag: "i",
            class: "svg-wrapper",
            style:
              "transition: all 0.2s ease-in-out; display: inline-block; line-height: 0; vertical-align: middle; width: 20px; height: 20px;",
            attributes: {},
            children: [
              {
                tag: "svg",
                class: "",
                style: "",
                attributes: {
                  xmlns: "http://www.w3.org/2000/svg",
                  fill: "none",
                  viewBox: "0 0 24 24",
                  "stroke-width": "1.5",
                  stroke: "currentColor",
                },
                children: [
                  {
                    tag: "path",
                    class: "",
                    style: "",
                    attributes: {
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round",
                      d: "m8.25 4.5 7.5 7.5-7.5 7.5",
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    );
  }

  return [
    {
      tag: "script",
      class: "",
      style: "",
      attributes: {},
      text: scriptText,
      children: [],
    },
    {
      tag: "section",
      class: sectionClass,
      style: params.showNavigation
        ? "position: relative; padding: 0 48px; width: 100%; box-sizing: border-box;"
        : "position: relative; width: 100%; box-sizing: border-box;",
      attributes: {},
      children: sectionChildren,
    },
  ];
}

export default function ButtonAddSwiper() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [sliderClass, setSliderClass] = useState("custom-swiper");
  const [slidesCount, setSlidesCount] = useState(6);
  const [slidesPerView, setSlidesPerView] = useState<number | "auto">(1);
  const [spaceBetween, setSpaceBetween] = useState(10);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(800);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [autoplayDelay, setAutoplayDelay] = useState(3000);
  const [showNavigation, setShowNavigation] = useState(true);
  const [showPagination, setShowPagination] = useState(true);
  const [useBreakpoints, setUseBreakpoints] = useState(false);
  const [breakpoints, setBreakpoints] = useState<SwiperBreakpoint[]>([
    { id: "bp-1", width: 768, slidesPerView: 2, spaceBetween: 15 },
    { id: "bp-2", width: 1200, slidesPerView: 3, spaceBetween: 20 },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const maxPerView = Math.max(
    slidesPerView === "auto" ? 1 : slidesPerView,
    ...(useBreakpoints
      ? breakpoints.map((b) =>
          b.slidesPerView === "auto" ? 1 : b.slidesPerView,
        )
      : [1]),
  );
  const loopNeedsMoreSlides = loop && slidesCount <= maxPerView;

  const addBreakpoint = () => {
    const lastWidth =
      breakpoints.length > 0 ? breakpoints[breakpoints.length - 1].width : 640;
    setBreakpoints((prev) => [
      ...prev,
      {
        id: `bp-${Date.now()}`,
        width: lastWidth + 240,
        slidesPerView: 4,
        spaceBetween: 20,
      },
    ]);
  };

  const updateBreakpoint = (
    id: string,
    patch: Partial<Omit<SwiperBreakpoint, "id">>,
  ) => {
    setBreakpoints((prev) =>
      prev.map((bp) => (bp.id === id ? { ...bp, ...patch } : bp)),
    );
  };

  const removeBreakpoint = (id: string) => {
    setBreakpoints((prev) => prev.filter((bp) => bp.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nodes = buildSwiperNodes({
      sliderClass,
      slidesCount,
      slidesPerView,
      spaceBetween,
      loop,
      speed,
      autoplayEnabled,
      autoplayDelay,
      showNavigation,
      showPagination,
      useBreakpoints,
      breakpoints,
    });

    await useCanvasStore.getState().appendRawNodes(nodes);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="admin-btn !justify-between"
        title="Configure and add Swiper slider"
      >
        <span className="flex items-center gap-1.5">
          <AdjustmentsHorizontalIcon className="size-3.5 text-cyan-400" />
          <span className="font-mono">+ Slider</span>
        </span>
        <span className="text-[10px] text-cyan-400/80 font-mono">Swiper</span>
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
              className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden font-mono text-xs text-zinc-200"
            >
              {/* Header */}
              <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AdjustmentsHorizontalIcon className="size-4 text-cyan-400" />
                  <span className="font-bold text-sm text-white">
                    Swiper Builder
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer"
                >
                  <XMarkIcon className="size-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4 max-h-[78vh] overflow-y-auto custom-scrollbar">
                {/* Класс и число слайдов в DOM */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase">
                      Slider Class
                    </span>
                    <input
                      type="text"
                      value={sliderClass}
                      onChange={(e) => setSliderClass(e.target.value)}
                      placeholder="custom-swiper"
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 focus:border-cyan-500 outline-none text-cyan-300"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase">
                      Slides in DOM
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={slidesCount}
                      onChange={(e) =>
                        setSlidesCount(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 focus:border-cyan-500 outline-none"
                    />
                  </label>
                </div>

                {/* Базовые параметры */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 uppercase">
                        {useBreakpoints ? "Per View (<bp)" : "Per View"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSlidesPerView((v) => (v === "auto" ? 1 : "auto"))
                        }
                        className={`px-1 rounded text-[9px] border cursor-pointer ${
                          slidesPerView === "auto"
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                            : "bg-zinc-900 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        auto
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      min={1}
                      disabled={slidesPerView === "auto"}
                      value={slidesPerView === "auto" ? "" : slidesPerView}
                      placeholder="auto"
                      onChange={(e) =>
                        setSlidesPerView(
                          Math.max(0.5, Number(e.target.value) || 1),
                        )
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 focus:border-cyan-500 outline-none disabled:opacity-40"
                    />
                  </div>

                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase">
                      {useBreakpoints ? "Gap px (<bp)" : "Gap (px)"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={spaceBetween}
                      onChange={(e) =>
                        setSpaceBetween(
                          Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 focus:border-cyan-500 outline-none"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase">
                      Speed (ms)
                    </span>
                    <input
                      type="number"
                      step={50}
                      min={0}
                      value={speed}
                      onChange={(e) =>
                        setSpeed(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 focus:border-cyan-500 outline-none"
                    />
                  </label>
                </div>

                {loopNeedsMoreSlides && (
                  <div className="px-2.5 py-1.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[10px]">
                    Для <strong>Loop</strong> желательно{" "}
                    <strong>Slides in DOM &gt; Per View</strong> (сейчас{" "}
                    {slidesCount} ≤ {maxPerView}).
                  </div>
                )}

                {/* Loop, Autoplay, Nav, Pagination */}
                <div className="p-3 rounded-lg bg-zinc-900/70 border border-zinc-800 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loop}
                        onChange={(e) => setLoop(e.target.checked)}
                        className="accent-cyan-500 cursor-pointer"
                      />
                      <span>Loop (бесконечная)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoplayEnabled}
                        onChange={(e) => setAutoplayEnabled(e.target.checked)}
                        className="accent-cyan-500 cursor-pointer"
                      />
                      <span>Autoplay</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showNavigation}
                        onChange={(e) => setShowNavigation(e.target.checked)}
                        className="accent-cyan-500 cursor-pointer"
                      />
                      <span>Arrows (prev/next)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPagination}
                        onChange={(e) => setShowPagination(e.target.checked)}
                        className="accent-cyan-500 cursor-pointer"
                      />
                      <span>Pagination (dots)</span>
                    </label>
                  </div>

                  {autoplayEnabled && (
                    <label className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-800">
                      <span className="text-zinc-400">Autoplay Delay (ms)</span>
                      <input
                        type="number"
                        step={100}
                        min={100}
                        value={autoplayDelay}
                        onChange={(e) =>
                          setAutoplayDelay(
                            Math.max(100, Number(e.target.value) || 3000),
                          )
                        }
                        className="w-28 px-2 py-1 rounded bg-zinc-950 border border-zinc-700 focus:border-cyan-500 outline-none text-right"
                      />
                    </label>
                  )}
                </div>

                {/* Breakpoints */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useBreakpoints}
                        onChange={(e) => setUseBreakpoints(e.target.checked)}
                        className="accent-cyan-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-zinc-300 uppercase font-bold">
                        Breakpoints (перебивают Per View / Gap от ширины)
                      </span>
                    </label>

                    {useBreakpoints && (
                      <button
                        type="button"
                        onClick={addBreakpoint}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-cyan-300 cursor-pointer"
                      >
                        <PlusIcon className="size-3" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>

                  {useBreakpoints && (
                    <div className="space-y-1.5">
                      {breakpoints.map((bp) => (
                        <div
                          key={bp.id}
                          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center bg-zinc-900/60 p-1.5 rounded border border-zinc-800"
                        >
                          <label className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-500">≥</span>
                            <input
                              type="number"
                              min={1}
                              value={bp.width}
                              onChange={(e) =>
                                updateBreakpoint(bp.id, {
                                  width: Math.max(
                                    1,
                                    Number(e.target.value) || 320,
                                  ),
                                })
                              }
                              className="w-full px-1.5 py-1 rounded bg-zinc-950 border border-zinc-700 focus:border-cyan-500 outline-none"
                              title="Min screen width (px)"
                            />
                          </label>

                          <label className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-500">
                              slides
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min={1}
                              value={
                                bp.slidesPerView === "auto"
                                  ? 1
                                  : bp.slidesPerView
                              }
                              onChange={(e) =>
                                updateBreakpoint(bp.id, {
                                  slidesPerView: Math.max(
                                    0.5,
                                    Number(e.target.value) || 1,
                                  ),
                                })
                              }
                              className="w-full px-1.5 py-1 rounded bg-zinc-950 border border-zinc-700 focus:border-cyan-500 outline-none"
                              title="slidesPerView"
                            />
                          </label>

                          <label className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-500">
                              gap
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={bp.spaceBetween}
                              onChange={(e) =>
                                updateBreakpoint(bp.id, {
                                  spaceBetween: Math.max(
                                    0,
                                    Number(e.target.value) || 0,
                                  ),
                                })
                              }
                              className="w-full px-1.5 py-1 rounded bg-zinc-950 border border-zinc-700 focus:border-cyan-500 outline-none"
                              title="spaceBetween (px)"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => removeBreakpoint(bp.id)}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Remove breakpoint"
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer shadow-lg shadow-cyan-950/50"
                >
                  Add Slider
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
