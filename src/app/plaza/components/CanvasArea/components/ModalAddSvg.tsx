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
import { treeToHtml } from "@/lib/htmlTree";

export interface ModalAddSvgProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSaveNode?: (node: HtmlNode) => void;
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

// Casing fixes for SVG XML tags and attributes
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

const DEFAULT_SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
</svg>`;

const PRESET_HEIGHTS = [16, 18, 20, 22, 24, 28, 32, 40, 48];

export default function ModalAddSvg({
  isOpen,
  setIsOpen,
  onSaveNode,
}: ModalAddSvgProps) {
  // Input mode: 'upload' | 'paste'
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [rawSvgInput, setRawSvgInput] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);

  // Output format mode:
  // 'inline-wrapper': <i> -> <svg> -> <path>... (requested JSON node tree, but distortion-free)
  // 'image-datauri': <img> with vector data:image/svg+xml;base64,... (like ModalAddImg, zero DOM overhead, 100% native render)
  const [outputMode, setOutputMode] = useState<
    "inline-wrapper" | "image-datauri"
  >("inline-wrapper");

  // Raw SVG and parsed node
  const [rawSvgClean, setRawSvgClean] = useState<string>("");
  const [baseSvgNode, setBaseSvgNode] = useState<HtmlNode | null>(null);
  const [meta, setMeta] = useState<SvgMetadata | null>(null);

  // Dimensions & Aspect ratio
  const [targetHeight, setTargetHeight] = useState<number>(22);
  const [targetWidth, setTargetWidth] = useState<number>(22);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);

  // Wrapper config
  const [wrapperClass, setWrapperClass] = useState<string>("svg-wrapper");

  // Color preservation / override
  // 'original' = 100% original fills, strokes, gradients untouched
  // 'currentcolor' = converts stroke/fill to currentColor
  // 'custom' = user picks a custom color
  const [colorMode, setColorMode] = useState<
    "original" | "currentcolor" | "custom"
  >("original");
  const [customColor, setCustomColor] = useState<string>("#3b82f6");

  // Tabs for inspector
  const [previewTab, setPreviewTab] = useState<"visual" | "json">("visual");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Convert SVG string to Base64 safely
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

  // Lock body scroll
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

  // Dimension helpers
  const handleHeightChange = (newH: number) => {
    const h = Math.max(8, newH);
    setTargetHeight(h);
    if (lockAspectRatio && meta && meta.aspectRatio > 0) {
      setTargetWidth(Math.round(h * meta.aspectRatio));
    }
  };

  const handleWidthChange = (newW: number) => {
    const w = Math.max(8, newW);
    setTargetWidth(w);
    if (lockAspectRatio && meta && meta.aspectRatio > 0) {
      setTargetHeight(Math.round(w / meta.aspectRatio));
    }
  };

  // Convert DOM Element to HtmlNode with exact case preservation
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

  // Parse SVG string
  const processSvgString = useCallback((raw: string) => {
    setParseError(null);
    const trimmed = raw.trim();
    if (!trimmed) {
      setParseError("Please provide SVG content.");
      return;
    }

    try {
      const parser = new DOMParser();
      let doc = parser.parseFromString(trimmed, "image/svg+xml");
      let svgEl = doc.querySelector("svg");

      if (!svgEl || doc.querySelector("parsererror")) {
        doc = parser.parseFromString(trimmed, "text/html");
        svgEl = doc.querySelector("svg");
      }

      if (!svgEl) {
        setParseError("No valid <svg> element found in the input.");
        return;
      }

      // Ensure xmlns
      if (!svgEl.getAttribute("xmlns")) {
        svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }

      // Extract viewBox and natural dimensions
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
      const initialH = 22;
      const initialW = Math.round(initialH * ratio);

      const parsedNode = domToHtmlNode(svgEl);
      const serializer = new XMLSerializer();
      const cleanSerialized = serializer.serializeToString(svgEl);
      const bytes = new Blob([cleanSerialized]).size;

      setBaseSvgNode(parsedNode);
      setRawSvgClean(cleanSerialized);
      setTargetHeight(initialH);
      setTargetWidth(initialW);
      setMeta({
        viewBox: viewBoxStr || `0 0 ${natW} ${natH}`,
        width: natW,
        height: natH,
        aspectRatio: ratio,
        elementCount: svgEl.querySelectorAll("*").length,
        bytes,
        sizeFormatted: formatFileSize(bytes),
      });
    } catch (err: any) {
      setParseError(err?.message || "Failed to parse SVG string.");
    }
  }, []);

  // Compute final SVG Node with color rules applied only if requested
  const processedSvgNode = useMemo<HtmlNode | null>(() => {
    if (!baseSvgNode) return null;

    // Deep clone to safely adjust attributes
    const node: HtmlNode = JSON.parse(JSON.stringify(baseSvgNode));

    // Ensure svg scales inside wrapper without relying on broken nested CSS
    const existingSvgStyle = node.style
      ? node.style.trim().replace(/;$/, "") + "; "
      : "";
    node.style = `${existingSvgStyle}width: 100%; height: 100%; display: block;`;

    if (colorMode === "currentcolor") {
      // If SVG has fill, adjust to currentColor; if stroke, adjust stroke
      node.attributes = node.attributes || {};
      if (node.attributes["stroke"] && node.attributes["stroke"] !== "none") {
        node.attributes["stroke"] = "currentColor";
      }
      if (node.attributes["fill"] && node.attributes["fill"] !== "none") {
        node.attributes["fill"] = "currentColor";
      }
    } else if (colorMode === "custom") {
      node.attributes = node.attributes || {};
      if (node.attributes["stroke"] && node.attributes["stroke"] !== "none") {
        node.attributes["stroke"] = customColor;
      }
      if (node.attributes["fill"] && node.attributes["fill"] !== "none") {
        node.attributes["fill"] = customColor;
      }
    }

    return node;
  }, [baseSvgNode, colorMode, customColor]);

  // Compute complete root HtmlNode depending on output mode
  const finalRootNode = useMemo<HtmlNode | null>(() => {
    if (!processedSvgNode && !rawSvgClean) return null;

    const key =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString();

    if (outputMode === "image-datauri") {
      // <img> approach with Data-URI Base64: 100% native render, 0 distortions, compact node
      const dataUri = svgToBase64(rawSvgClean);
      const imgNode: HtmlNode = {
        tag: "img",
        text: "",
        class: "svg-img",
        style: `width: ${targetWidth}px; height: ${targetHeight}px; display: inline-block; vertical-align: middle;`,
        attributes: {
          src: dataUri,
          alt: "svg-icon",
        },
        children: [],
        _key: key,
        _isNew: true,
      };
      return imgNode;
    }

    // Default inline wrapper mode (<i> -> <svg> -> <path>...)
    const wrapperStyle = `transition: all 0.2s ease-in-out; display: inline-block; line-height: 0; vertical-align: middle; width: ${targetWidth}px; height: ${targetHeight}px; svg { width: 100%; height: 100%; display: inline-block; }`;

    const inlineNode: HtmlNode = {
      tag: "i",
      text: "",
      class: wrapperClass.trim() || "svg-wrapper",
      style: wrapperStyle,
      attributes: {},
      children: [processedSvgNode!],
      _key: key,
      _isNew: true,
    };
    return inlineNode;
  }, [
    processedSvgNode,
    rawSvgClean,
    outputMode,
    targetWidth,
    targetHeight,
    wrapperClass,
  ]);

  const processFile = (file: File) => {
    if (
      !file ||
      (!file.type.includes("svg") && !file.name.toLowerCase().endsWith(".svg"))
    ) {
      alert("Please select a valid .svg file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        processSvgString(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleReset = () => {
    setBaseSvgNode(null);
    setRawSvgClean("");
    setRawSvgInput("");
    setMeta(null);
    setParseError(null);
    setTargetHeight(22);
    setTargetWidth(22);
    setLockAspectRatio(true);
    setWrapperClass("svg-wrapper");
    setColorMode("original");
    setOutputMode("inline-wrapper");
    setPreviewTab("visual");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCopySvg = async () => {
    if (!rawSvgClean) return;
    try {
      await navigator.clipboard.writeText(rawSvgClean);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawSvgInput(text);
        processSvgString(text);
      }
    } catch {
      alert(
        "Unable to read clipboard. Please paste manually into the textarea.",
      );
    }
  };

  // Save to IndexedDB
  const handleSave = async () => {
    if (!finalRootNode) return;

    try {
      const existing = await getHtmlJson(DB_KEY).catch(() => null);
      const currentList: HtmlNode[] = existing
        ? Array.isArray(existing)
          ? existing
          : [existing]
        : [];
      const nextList = [...currentList, finalRootNode];

      await saveHtmlJson(DB_KEY, nextList);

      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", { detail: nextList }),
      );

      if (onSaveNode) onSaveNode(finalRootNode);
      setIsOpen(false);
    } catch (err) {
      console.error("[ModalAddSvg] Persist error:", err);
    }
  };

  const previewHtml = processedSvgNode
    ? treeToHtml(processedSvgNode)
    : rawSvgClean;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="fixed inset-0 w-screen h-screen bg-black/98 z-50 overflow-y-auto no-scrollbar flex flex-col items-center justify-between p-6 sm:p-10"
        >
          {/* Close button */}
          <div className="absolute top-6 right-8 z-10">
            <ButtonClose setClose={setIsOpen} />
          </div>

          {/* Header */}
          <div className="w-full text-center mt-2">
            <h2 className="text-2xl font-bold text-neutral-100 tracking-wide">
              Add SVG Vector
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Zero-distortion vector SVG loader with aspect ratio locking &
              original color preservation
            </p>
          </div>

          {/* Main workspace */}
          <div className="w-full max-w-4xl my-auto flex flex-col items-center py-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".svg,image/svg+xml"
              className="hidden"
            />

            {!baseSvgNode ? (
              /* Input Tabs / Dropzone Area */
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
                    📁 Upload .svg File
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
                      const file = e.dataTransfer.files?.[0];
                      if (file) processFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full h-[300px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
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
                          strokeWidth="1.5"
                          d="M12 4.5v15m7.5-7.5h-15M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-medium text-neutral-200">
                      Click to browse or drop your .svg file here
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Retains original paths, colors, gradients & aspect ratios
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
                      placeholder={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ...>\n  <path ... />\n</svg>`}
                      rows={9}
                      className="w-full p-3.5 bg-neutral-900/90 border border-neutral-700 rounded-xl text-xs font-mono text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-500 transition-all resize-y"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        onClick={handlePasteFromClipboard}
                        className="text-xs text-neutral-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800"
                      >
                        📋 Paste from Clipboard
                      </button>

                      <button
                        onClick={() => processSvgString(rawSvgInput)}
                        disabled={!rawSvgInput.trim()}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                      >
                        Parse & Preview SVG
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center pt-1">
                  <button
                    onClick={() => {
                      setRawSvgInput(DEFAULT_SAMPLE_SVG);
                      processSvgString(DEFAULT_SAMPLE_SVG);
                    }}
                    className="text-xs text-neutral-500 hover:text-blue-400 underline underline-offset-4 transition cursor-pointer"
                  >
                    Try Sample Heroicon SVG
                  </button>
                </div>

                {parseError && (
                  <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-300">
                    {parseError}
                  </div>
                )}
              </div>
            ) : (
              /* Preview & Controls Area */
              <div className="w-full flex flex-col items-center gap-5">
                {/* SVG Live Preview Card */}
                <div className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-2xl p-6 overflow-hidden shadow-2xl flex flex-col items-center justify-center min-h-[220px]">
                  {/* Top-Right Action Controls */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      onClick={handleCopySvg}
                      className="bg-black/75 hover:bg-neutral-700 text-neutral-300 text-xs px-3 py-1.5 rounded-md backdrop-blur-md transition-all cursor-pointer font-medium"
                    >
                      {copied ? "✓ Copied!" : "Copy SVG"}
                    </button>
                    <button
                      onClick={handleReset}
                      className="bg-black/75 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-md backdrop-blur-md transition-all cursor-pointer"
                    >
                      Replace SVG
                    </button>
                  </div>

                  {/* Dual Preview */}
                  <div className="flex items-center gap-12 py-4">
                    {/* Real 1:1 Scale */}
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">
                        Real Scale ({targetWidth} × {targetHeight} px)
                      </span>
                      <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-xl flex items-center justify-center shadow-inner min-w-[70px] min-h-[70px]">
                        {outputMode === "inline-wrapper" ? (
                          <i
                            className={wrapperClass}
                            style={{
                              display: "inline-block",
                              lineHeight: 0,
                              verticalAlign: "middle",
                              width: `${targetWidth}px`,
                              height: `${targetHeight}px`,
                            }}
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={svgToBase64(rawSvgClean)}
                            alt="preview"
                            style={{
                              width: `${targetWidth}px`,
                              height: `${targetHeight}px`,
                              objectFit: "contain",
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Zoomed Inspection Preview */}
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">
                        Zoomed View (100% Vector Quality)
                      </span>
                      <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-xl flex items-center justify-center shadow-inner">
                        <div
                          style={{
                            width: "72px",
                            height: "72px",
                            display: "inline-block",
                            lineHeight: 0,
                          }}
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadata & Badges */}
                {meta && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">ViewBox:</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {meta.viewBox}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Ratio:</span>
                      <span className="text-blue-400 font-mono font-bold">
                        {meta.aspectRatio.toFixed(2)} : 1
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Elements:</span>
                      <span className="text-amber-400 font-mono font-bold">
                        {meta.elementCount}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs font-medium text-neutral-300">
                      <span className="text-neutral-500">Size:</span>
                      <span className="text-purple-400 font-mono font-bold">
                        {meta.sizeFormatted}
                      </span>
                    </div>
                  </div>
                )}

                {/* Output Mode & Settings */}
                <div className="w-full max-w-2xl bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
                  {/* Output Mode Switcher: Inline SVG vs Image Data-URI */}
                  <div className="flex flex-col gap-2 pb-3 border-b border-neutral-800">
                    <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                      Способ сохранения (Output Mode):
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setOutputMode("inline-wrapper")}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                          outputMode === "inline-wrapper"
                            ? "bg-blue-600/10 border-blue-500 text-white"
                            : "bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                          <span>🧩 Inline SVG (&lt;i&gt; + &lt;svg&gt;)</span>
                        </div>
                        <span className="text-[11px] text-neutral-400">
                          Инлайн дерево нод. Доступ к классам, ховерам и путям в
                          холсте.
                        </span>
                      </button>

                      <button
                        onClick={() => setOutputMode("image-datauri")}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                          outputMode === "image-datauri"
                            ? "bg-blue-600/10 border-blue-500 text-white"
                            : "bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                          <span>🖼️ Векторный &lt;img&gt; (Data-URI)</span>
                        </div>
                        <span className="text-[11px] text-neutral-400">
                          Как в ModalAddImg. Абсолютно 0 искажений, компактная
                          нода, нативный рендер.
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Settings / JSON tabs */}
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                    <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider">
                      Параметры и стили
                    </span>
                    <div className="flex items-center gap-1 bg-neutral-800/80 p-0.5 rounded-lg">
                      <button
                        onClick={() => setPreviewTab("visual")}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                          previewTab === "visual"
                            ? "bg-neutral-700 text-white"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Настройки
                      </button>
                      <button
                        onClick={() => setPreviewTab("json")}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                          previewTab === "json"
                            ? "bg-neutral-700 text-white"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        JSON Node Tree
                      </button>
                    </div>
                  </div>

                  {previewTab === "visual" ? (
                    <>
                      {/* Dimensions with Aspect Ratio Lock */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs text-neutral-300">
                          <span>Размеры (Ширина × Высота):</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setLockAspectRatio(!lockAspectRatio)
                              }
                              className={`px-2 py-0.5 rounded text-[11px] border transition cursor-pointer flex items-center gap-1 ${
                                lockAspectRatio
                                  ? "bg-blue-600/20 border-blue-500 text-blue-300 font-semibold"
                                  : "bg-neutral-800 border-neutral-700 text-neutral-400"
                              }`}
                            >
                              {lockAspectRatio
                                ? "🔒 Пропорции зафиксированы"
                                : "🔓 Свободные размеры"}
                            </button>
                            <span className="font-mono text-blue-400 font-semibold">
                              {targetWidth} × {targetHeight} px
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Height */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-[11px] text-neutral-400">
                              <span>Высота (Height):</span>
                              <span className="font-mono text-neutral-200">
                                {targetHeight}px
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="12"
                                max="120"
                                step="1"
                                value={targetHeight}
                                onChange={(e) =>
                                  handleHeightChange(
                                    parseInt(e.target.value, 10),
                                  )
                                }
                                className="flex-1 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <input
                                type="number"
                                min="8"
                                max="512"
                                value={targetHeight}
                                onChange={(e) =>
                                  handleHeightChange(
                                    parseInt(e.target.value, 10) || 16,
                                  )
                                }
                                className="w-14 px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-xs font-mono text-neutral-200 text-center outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          {/* Width */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-[11px] text-neutral-400">
                              <span>Ширина (Width):</span>
                              <span className="font-mono text-neutral-200">
                                {targetWidth}px
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="12"
                                max="160"
                                step="1"
                                value={targetWidth}
                                onChange={(e) =>
                                  handleWidthChange(
                                    parseInt(e.target.value, 10),
                                  )
                                }
                                className="flex-1 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <input
                                type="number"
                                min="8"
                                max="512"
                                value={targetWidth}
                                onChange={(e) =>
                                  handleWidthChange(
                                    parseInt(e.target.value, 10) || 16,
                                  )
                                }
                                className="w-14 px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-xs font-mono text-neutral-200 text-center outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Preset buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-neutral-500 mr-1">
                            Быстрый размер:
                          </span>
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

                      {/* Color Preservation / Mode */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800/80">
                        <span className="text-xs text-neutral-300 font-medium">
                          Цветовая палитра:
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
                            <div className="text-[10px] text-neutral-500 font-normal mt-0.5">
                              Без изменений цветов
                            </div>
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
                            <div className="text-[10px] text-neutral-500 font-normal mt-0.5">
                              Цвет текста родителя
                            </div>
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
                            <div className="text-[10px] text-neutral-500 font-normal mt-0.5">
                              Пользовательский цвет
                            </div>
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

                      {/* Wrapper CSS class for inline mode */}
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
                    </>
                  ) : (
                    /* JSON Inspector */
                    <div className="flex flex-col gap-2">
                      <div className="max-h-[260px] overflow-y-auto no-scrollbar bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                        <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap break-all select-all">
                          {JSON.stringify(
                            finalRootNode ? [finalRootNode] : [],
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>
                  )}
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
              disabled={!finalRootNode}
              onClick={handleSave}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg cursor-pointer ${
                finalRootNode
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
