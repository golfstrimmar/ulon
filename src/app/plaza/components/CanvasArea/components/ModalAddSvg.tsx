"use client";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import ButtonClose from "@/components/ButtonClose";
import { getHtmlJson, saveHtmlJson } from "@/lib/htmlStorage";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import type { HtmlNode } from "@/types/HtmlNode";

export interface ModalAddSvgProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSaveNodes?: (nodes: HtmlNode[]) => void;
}

interface SvgMetadata {
  viewBox: string;
  width: number;
  height: number;
  aspectRatio: number;
  elementCount: number;
  bytes: number;
  sizeFormatted: string;
}

interface SvgItem {
  id: string;
  name: string;
  rawClean: string;
  baseNode: HtmlNode;
  meta: SvgMetadata;
  selected: boolean;
}

const SVG_TAG_CASING: Record<string, string> = {
  clippath: "clipPath",
  lineargradient: "linearGradient",
  radialgradient: "radialGradient",
  textpath: "textPath",
  foreignobject: "foreignObject",
  fegaussianblur: "feGaussianBlur",
  femerge: "feMerge",
  femergenode: "feMergeNode",
  fecolormatrix: "feColorMatrix",
  fecomposite: "feComposite",
  feblend: "feBlend",
  feoffset: "feOffset",
  fedropshadow: "feDropShadow",
  animatecolor: "animateColor",
  animatemotion: "animateMotion",
  animatetransform: "animateTransform",
};

const SVG_ATTR_CASING: Record<string, string> = {
  viewbox: "viewBox",
  preserveaspectratio: "preserveAspectRatio",
  gradientunits: "gradientUnits",
  gradienttransform: "gradientTransform",
  spreadmethod: "spreadMethod",
  patternunits: "patternUnits",
  patterntransform: "patternTransform",
  clippathunits: "clipPathUnits",
  maskcontentunits: "maskContentUnits",
  maskunits: "maskUnits",
  stddeviation: "stdDeviation",
  startoffset: "startOffset",
  textlength: "textLength",
  lengthadjust: "lengthAdjust",
  pathlength: "pathLength",
  basefrequency: "baseFrequency",
  numoctaves: "numOctaves",
};

const PRESET_HEIGHTS = [16, 18, 20, 22, 24, 28, 32, 40, 48];

export default function ModalAddSvg({
  isOpen,
  setIsOpen,
  onSaveNodes,
}: ModalAddSvgProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [rawSvgInput, setRawSvgInput] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);

  // Список загруженных SVG элементов
  const [svgItems, setSvgItems] = useState<SvgItem[]>([]);

  // Глобальные настройки для пачки
  const [outputMode, setOutputMode] = useState<"inline-wrapper" | "image-datauri">("inline-wrapper");
  const [targetHeight, setTargetHeight] = useState<number>(22);
  const [targetWidth, setTargetWidth] = useState<number>(22);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [wrapperClass, setWrapperClass] = useState<string>("svg-wrapper");

  const [colorMode, setColorMode] = useState<"original" | "currentcolor" | "custom">("original");
  const [customColor, setCustomColor] = useState<string>("#3b82f6");

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const svgToBase64 = (svgStr: string): string => {
    try {
      const clean = svgStr.trim();
      const utf8Bytes = new TextEncoder().encode(clean);
      let binary = "";
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
      }
      return `data:image/svg+xml;base64,${btoa(binary)}`;
    } catch {
      return `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
    }
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

  const handleHeightChange = (newH: number) => {
    const h = Math.max(8, newH);
    setTargetHeight(h);
    if (lockAspectRatio) {
      setTargetWidth(h);
    }
  };

  const handleWidthChange = (newW: number) => {
    const w = Math.max(8, newW);
    setTargetWidth(w);
    if (lockAspectRatio) {
      setTargetHeight(w);
    }
  };

  const domToHtmlNode = (el: Element): HtmlNode => {
    const rawTag = el.tagName;
    const lowerTag = rawTag.toLowerCase();
    const tag = SVG_TAG_CASING[lowerTag] || rawTag;

    const attributes: Record<string, string> = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (attr.name === "class" || attr.name === "style") continue;
      const lowerAttrName = attr.name.toLowerCase();
      const attrName = SVG_ATTR_CASING[lowerAttrName] || attr.name;
      attributes[attrName] = attr.value;
    }

    const children: HtmlNode[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (child.tagName.toLowerCase() === "script") continue;
      children.push(domToHtmlNode(child));
    }

    let text = "";
    if (children.length === 0 && el.textContent) {
      const trimmed = el.textContent.trim();
      if (trimmed) text = trimmed;
    }
    const rawClass = el.getAttribute("class") || "";
    const cleanClass = rawClass.replace(/\bsvg-custom\b/g, "").trim();
    return {
      tag,
      text,
      class: cleanClass,
      style: el.getAttribute("style") || "",
      attributes,
      children,
      _key:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${tag}-${Math.random().toString(36).substring(2, 9)}`,
    };
  };

  /** Парсер одной строки SVG в структуру SvgItem */
  const parseSingleSvg = useCallback(
    (raw: string, fileName?: string): SvgItem | null => {
      const trimmed = raw.trim();
      if (!trimmed) return null;

      try {
        const parser = new DOMParser();
        let doc = parser.parseFromString(trimmed, "image/svg+xml");
        let svgEl = doc.querySelector("svg");

        if (!svgEl || doc.querySelector("parsererror")) {
          doc = parser.parseFromString(trimmed, "text/html");
          svgEl = doc.querySelector("svg");
        }

        if (!svgEl) return null;

        if (!svgEl.getAttribute("xmlns")) {
          svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        }

        const viewBoxStr =
          svgEl.getAttribute("viewBox") || svgEl.getAttribute("viewbox") || "";
        let natW = 24;
        let natH = 24;

        if (viewBoxStr) {
          const parts = viewBoxStr
            .trim()
            .split(/[\s,]+/)
            .map(Number);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            natW = parts[2];
            natH = parts[3];
          }
        } else {
          const wAttr = parseFloat(svgEl.getAttribute("width") || "");
          const hAttr = parseFloat(svgEl.getAttribute("height") || "");
          if (!isNaN(wAttr) && !isNaN(hAttr) && wAttr > 0 && hAttr > 0) {
            natW = wAttr;
            natH = hAttr;
            svgEl.setAttribute("viewBox", `0 0 ${natW} ${natH}`);
          }
        }

        const ratio = natW / natH;
        const parsedNode = domToHtmlNode(svgEl);
        const serializer = new XMLSerializer();
        const cleanSerialized = serializer.serializeToString(svgEl);
        const bytes = new Blob([cleanSerialized]).size;

        return {
          id: `svg_item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: fileName || `icon_${svgItems.length + 1}.svg`,
          rawClean: cleanSerialized,
          baseNode: parsedNode,
          meta: {
            viewBox: viewBoxStr || `0 0 ${natW} ${natH}`,
            width: natW,
            height: natH,
            aspectRatio: ratio,
            elementCount: svgEl.querySelectorAll("*").length,
            bytes,
            sizeFormatted: formatFileSize(bytes),
          },
          selected: true,
        };
      } catch {
        return null;
      }
    },
    [svgItems.length],
  );

  /** Обработка множества файлов */
  const processFiles = (files: FileList | File[]) => {
    setParseError(null);
    const validFiles = Array.from(files).filter(
      (f) => f.type.includes("svg") || f.name.toLowerCase().endsWith(".svg"),
    );

    if (validFiles.length === 0) {
      setParseError("Please select valid .svg files.");
      return;
    }

    const readers = validFiles.map((file) => {
      return new Promise<SvgItem | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            const item = parseSingleSvg(reader.result, file.name);
            resolve(item);
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      });
    });

    Promise.all(readers).then((results) => {
      const added = results.filter(Boolean) as SvgItem[];
      if (added.length === 0) {
        setParseError("Could not parse any valid SVG from selected files.");
      } else {
        setSvgItems((prev) => [...prev, ...added]);
      }
    });
  };

  /** Обработка вставленного текста (может содержать сразу несколько <svg>...</svg>) */
  const processRawText = (text: string) => {
    setParseError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setParseError("Please provide SVG content.");
      return;
    }

    // Ищем все блоки <svg>...</svg> в тексте
    const svgMatches = trimmed.match(/<svg[\s\S]*?<\/svg>/gi);

    if (svgMatches && svgMatches.length > 0) {
      const added: SvgItem[] = [];
      svgMatches.forEach((svgStr, idx) => {
        const item = parseSingleSvg(svgStr, `pasted_icon_${idx + 1}.svg`);
        if (item) added.push(item);
      });

      if (added.length > 0) {
        setSvgItems((prev) => [...prev, ...added]);
        setRawSvgInput("");
        return;
      }
    }

    // Если регулярка не нашла несколько, пробуем спарсить как один
    const single = parseSingleSvg(trimmed, "pasted_icon.svg");
    if (single) {
      setSvgItems((prev) => [...prev, single]);
      setRawSvgInput("");
    } else {
      setParseError("No valid <svg> elements found in pasted text.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleResetAll = () => {
    setSvgItems([]);
    setRawSvgInput("");
    setParseError(null);
    setTargetHeight(22);
    setTargetWidth(22);
    setLockAspectRatio(true);
    setWrapperClass("svg-wrapper");
    setColorMode("original");
    setOutputMode("inline-wrapper");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleItemSelect = (id: string) => {
    setSvgItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const removeItem = (id: string) => {
    setSvgItems((prev) => prev.filter((it) => it.id !== id));
  };

  const selectAll = (val: boolean) => {
    setSvgItems((prev) => prev.map((it) => ({ ...it, selected: val })));
  };

  // Превращение выбранных SvgItem в итоговые HtmlNode
  const buildFinalNodes = (): HtmlNode[] => {
    const selected = svgItems.filter((i) => i.selected);

    return selected.map((item) => {
      const key = `svg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 1. Режим <img src="data:image/svg+xml;base64,...">
      if (outputMode === "image-datauri") {
        const dataUri = svgToBase64(item.rawClean);
        return {
          tag: "img",
          text: "",
          class: "svg-img",
          style: `width: ${targetWidth}px; height: ${targetHeight}px; display: inline-block; vertical-align: middle;`,
          attributes: {
            src: dataUri,
            alt: item.name.replace(/\.svg$/i, ""),
          },
          children: [],
          _key: key,
        };
      }

      // 2. Режим Inline <i class="..."><svg></i>
      const clonedNode: HtmlNode = JSON.parse(JSON.stringify(item.baseNode));
      clonedNode.attributes = clonedNode.attributes || {};
      clonedNode.attributes["width"] = "100%";
      clonedNode.attributes["height"] = "100%";
      clonedNode.style = "width: 100%; height: 100%; display: block;";

      if (colorMode === "currentcolor") {
        if (clonedNode.attributes["stroke"] && clonedNode.attributes["stroke"] !== "none") {
          clonedNode.attributes["stroke"] = "currentColor";
        }
        if (clonedNode.attributes["fill"] && clonedNode.attributes["fill"] !== "none") {
          clonedNode.attributes["fill"] = "currentColor";
        }
      } else if (colorMode === "custom") {
        if (clonedNode.attributes["stroke"] && clonedNode.attributes["stroke"] !== "none") {
          clonedNode.attributes["stroke"] = customColor;
        }
        if (clonedNode.attributes["fill"] && clonedNode.attributes["fill"] !== "none") {
          clonedNode.attributes["fill"] = customColor;
        }
      }

      return {
        tag: "i",
        text: "",
        class: wrapperClass.trim() || "svg-wrapper",
        style: `display: inline-block; line-height: 0; vertical-align: middle; width: ${targetWidth}px; height: ${targetHeight}px;`,
        attributes: {},
        children: [clonedNode],
        _key: key,
      };
    });
  };

  const handleSave = async () => {
    const nodesToSave = buildFinalNodes();
    if (nodesToSave.length === 0) return;

    try {
      const existing = await getHtmlJson(DB_KEY).catch(() => null);
      const currentList: HtmlNode[] = existing
        ? Array.isArray(existing)
          ? existing
          : [existing]
        : [];
      const nextList = [...currentList, ...nodesToSave];

      await saveHtmlJson(DB_KEY, nextList);

      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", {
          detail: { nodes: nextList, source: "modal-add-svg" },
        }),
      );

      if (onSaveNodes) onSaveNodes(nodesToSave);
      setIsOpen(false);
    } catch (err) {
      console.error("[ModalAddSvg] Bulk save error:", err);
    }
  };

  const selectedCount = svgItems.filter((i) => i.selected).length;

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
              Batch Add SVG Vectors
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
              Загружайте пачками любые SVG: файлы, папки или множественный код.
            </p>
          </div>

          <div className="w-full max-w-5xl my-auto flex flex-col items-center py-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".svg,image/svg+xml"
              multiple // 👈 Разрешаем выбор нескольких файлов
              className="hidden"
            />

            {svgItems.length === 0 ? (
              <div className="w-full max-w-2xl flex flex-col gap-4">
                <div className="flex items-center justify-center gap-2 p-1 bg-neutral-900 border border-neutral-800 rounded-xl self-center">
                  <button
                    onClick={() => setActiveTab("upload")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      activeTab === "upload"
                        ? "bg-neutral-800 text-white shadow-sm"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    📁 Upload Multiple .svg Files
                  </button>
                  <button
                    onClick={() => setActiveTab("paste")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      activeTab === "paste"
                        ? "bg-neutral-800 text-white shadow-sm"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    📋 Paste SVG Code
                  </button>
                </div>

                {activeTab === "upload" ? (
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
                    className={`w-full h-[280px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                      isDragging
                        ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
                        : "border-neutral-700 hover:border-neutral-500 bg-neutral-900/50 hover:bg-neutral-900/80"
                    }`}
                  >
                    <div className="p-4 rounded-full bg-neutral-800 text-neutral-300 mb-3 shadow-inner">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.5v15m7.5-7.5h-15M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                      </svg>
                    </div>
                    <p className="text-base font-medium text-neutral-200">
                      Click to choose or drop multiple .svg files here
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Вы можете выбрать сразу 10, 50 или 100 иконок одновременно
                    </p>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-3">
                    <textarea
                      value={rawSvgInput}
                      onChange={(e) => {
                        setRawSvgInput(e.target.value);
                        setParseError(null);
                      }}
                      placeholder={`Вставьте один или несколько SVG подряд:\n<svg ...>...</svg>\n<svg ...>...</svg>`}
                      rows={8}
                      className="w-full p-3.5 bg-neutral-900/90 border border-neutral-700 rounded-xl text-xs font-mono text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-500 transition-all resize-y"
                    />

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => processRawText(rawSvgInput)}
                        disabled={!rawSvgInput.trim()}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Parse & Add to List
                      </button>
                    </div>
                  </div>
                )}

                {parseError && (
                  <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-300">
                    {parseError}
                  </div>
                )}
              </div>
            ) : (
              /* ================== РЕЖИМ ГАЛЕРЕИ И МАССОВОЙ НАСТРОЙКИ ================== */
              <div className="w-full flex flex-col gap-5">
                {/* Панель управления выбранными иконками */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-3 px-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-neutral-300">
                      Loaded: <b className="text-white">{svgItems.length}</b> icons
                    </span>
                    <span className="text-neutral-600">|</span>
                    <span className="text-xs font-medium text-blue-400">
                      Selected: <b>{selectedCount}</b>
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
                      + Add More Files
                    </button>
                    <button
                      onClick={handleResetAll}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-950/40 border border-red-900/40 transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Сетка превью иконок */}
                <div className="w-full max-h-[300px] overflow-y-auto custom-scrollbar p-2 bg-neutral-950 border border-neutral-800/80 rounded-2xl grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {svgItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleItemSelect(item.id)}
                      className={`relative group p-3 rounded-xl border flex flex-col items-center justify-between gap-2 transition cursor-pointer ${
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

                      {/* Кнопка удаления отдельной иконки */}
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

                      {/* Превью иконки */}
                      <div className="w-14 h-14 flex items-center justify-center p-1.5 bg-neutral-900/80 rounded-lg my-1">
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            color:
                              colorMode === "custom"
                                ? customColor
                                : colorMode === "currentcolor"
                                  ? "#ffffff"
                                  : undefined,
                          }}
                          dangerouslySetInnerHTML={{ __html: item.rawClean }}
                        />
                      </div>

                      <span
                        title={item.name}
                        className="text-[10px] text-neutral-400 font-mono text-center truncate max-w-full"
                      >
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Общие настройки для всех выбранных иконок */}
                <div className="w-full bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-2 pb-3 border-b border-neutral-800">
                    <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                      Способ сохранения (Output Mode):
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setOutputMode("inline-wrapper")}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                          outputMode === "inline-wrapper"
                            ? "bg-blue-600/10 border-blue-500 text-white"
                            : "bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <span className="text-xs font-semibold text-neutral-200">
                          🧩 Inline SVG (&lt;i&gt; + &lt;svg&gt;)
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          Полноценное дерево нод. Доступ к классам и hover в холсте.
                        </span>
                      </button>

                      <button
                        onClick={() => setOutputMode("image-datauri")}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                          outputMode === "image-datauri"
                            ? "bg-blue-600/10 border-blue-500 text-white"
                            : "bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <span className="text-xs font-semibold text-neutral-200">
                          🖼️ Векторный &lt;img&gt; (Data-URI)
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          Компактная одиночная нода без искажений.
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Размеры */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-neutral-300">
                      <span>Размеры для всех иконок:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLockAspectRatio(!lockAspectRatio)}
                          className={`px-2 py-0.5 rounded text-[11px] border transition cursor-pointer ${
                            lockAspectRatio
                              ? "bg-blue-600/20 border-blue-500 text-blue-300 font-semibold"
                              : "bg-neutral-800 border-neutral-700 text-neutral-400"
                          }`}
                        >
                          {lockAspectRatio ? "🔒 Квадрат (1:1)" : "🔓 Свободный"}
                        </button>
                        <span className="font-mono text-blue-400 font-semibold">
                          {targetWidth} × {targetHeight} px
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[11px] text-neutral-400">
                          <span>Высота:</span>
                          <span className="font-mono text-neutral-200">{targetHeight}px</span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="120"
                          value={targetHeight}
                          onChange={(e) => handleHeightChange(parseInt(e.target.value, 10))}
                          className="h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[11px] text-neutral-400">
                          <span>Ширина:</span>
                          <span className="font-mono text-neutral-200">{targetWidth}px</span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="120"
                          value={targetWidth}
                          onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
                          className="h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-neutral-500 mr-1">Пресеты:</span>
                      {PRESET_HEIGHTS.map((h) => (
                        <button
                          key={h}
                          onClick={() => handleHeightChange(h)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                            targetHeight === h
                              ? "bg-blue-600 text-white font-bold"
                              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                          }`}
                        >
                          {h}px
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Цвета */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800/80">
                    <span className="text-xs text-neutral-300 font-medium">
                      Цветовой режим:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setColorMode("original")}
                        className={`px-3 py-2 rounded-lg border text-left text-xs transition cursor-pointer ${
                          colorMode === "original"
                            ? "bg-emerald-600/15 border-emerald-500 text-emerald-300 font-semibold"
                            : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        🎨 Оригинал (1:1)
                      </button>

                      <button
                        onClick={() => setColorMode("currentcolor")}
                        className={`px-3 py-2 rounded-lg border text-left text-xs transition cursor-pointer ${
                          colorMode === "currentcolor"
                            ? "bg-blue-600/15 border-blue-500 text-blue-300 font-semibold"
                            : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        🔤 currentColor
                      </button>

                      <button
                        onClick={() => setColorMode("custom")}
                        className={`px-3 py-2 rounded-lg border text-left text-xs transition cursor-pointer ${
                          colorMode === "custom"
                            ? "bg-purple-600/15 border-purple-500 text-purple-300 font-semibold"
                            : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        🎯 Свой цвет
                      </button>
                    </div>

                    {colorMode === "custom" && (
                      <div className="flex items-center gap-3 pt-1">
                        <input
                          type="color"
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          className="w-8 h-8 rounded border border-neutral-700 bg-neutral-800 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          className="w-32 px-2.5 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs font-mono text-neutral-200"
                        />
                      </div>
                    )}
                  </div>

                  {outputMode === "inline-wrapper" && (
                    <div className="flex flex-col gap-1 pt-2 border-t border-neutral-800/80">
                      <label className="text-xs text-neutral-400">
                        CSS класс обёртки &lt;i&gt;:
                      </label>
                      <input
                        type="text"
                        value={wrapperClass}
                        onChange={(e) => setWrapperClass(e.target.value)}
                        className="w-full px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 font-mono outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Нижний бар сохранения */}
          <div className="w-full max-w-5xl flex items-center justify-between pt-4 border-t border-neutral-800">
            <span className="text-xs text-neutral-500">
              {selectedCount > 0
                ? `Готово к сохранению: ${selectedCount} шт.`
                : "Выберите или загрузите SVG"}
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-sm font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={selectedCount === 0}
                onClick={handleSave}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg cursor-pointer ${
                  selectedCount > 0
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95"
                    : "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50"
                }`}
              >
                Save {selectedCount > 0 ? `(${selectedCount})` : ""} to Database
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
