"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  getHtmlJson,
  saveHtmlJson,
  deleteHtmlJson,
  getGlobalScss,
  getGlobalJs,
} from "@/lib/htmlStorage";
import {
  generateNodeKey,
  moveNodePosition,
  findNodeByKey,
  isDescendant,
  duplicateNodeInTree,
  deleteNodeFromArray,
  updateNodeByKey,
} from "@/lib/htmlTree";
import { ROOT_TAGS, ELEMENT_FOLDERS } from "./elementsManifest";
import { MonacoPropertiesEditor } from "../MonacoPropertiesEditor/MonacoPropertiesEditor";
import { motion, AnimatePresence } from "framer-motion";
import { updateScriptInGlobalBundle } from "@/lib/jsCompiler";
import { saveGlobalScss, saveGlobalJs } from "@/lib/htmlStorage";
const DB_KEY = "plaza_tree";

function sanitizeCssBody(css: string): string {
  return css.replace(/\}\s*;/g, "}").trim();
}

/**
 * ИЗВЛЕКАЕТ И СТИЛИ, И СКРИПТЫ ИЗ НОД
 * Любой node.style, node.script, node.js или <script> вытаскивается,
 * а очищенные ноды отдаются в разметку.
 */
function extractStylesAndScriptsFromNodes(nodes: HtmlNode[]): {
  cleanNodes: HtmlNode[];
  extractedScss: string;
  extractedScripts: { name: string; code: string }[];
} {
  const extractedRules: string[] = [];
  const extractedScripts: { name: string; code: string }[] = [];

  function processNode(node: HtmlNode): HtmlNode | null {
    const key = node._key || generateNodeKey();
    const tag = (node.tag || "div").toLowerCase();
    let classList = (node.class || "").split(/\s+/).filter(Boolean);
    const targetName = classList[0] || `${tag}-${key.slice(-5)}`;

    // 1. Если это тег <script>
    if (tag === "script") {
      const code = (node.text || "").trim();
      if (code) {
        // Проверяем, есть ли в первой строке аннотация /* @component: .my-name */
        const componentMatch = /\/\*\s*@component:\s*\.?([a-zA-Z0-9_-]+)/.exec(
          code,
        );
        const scriptName = componentMatch ? componentMatch[1] : targetName;

        extractedScripts.push({ name: scriptName, code });
      }
      return null;
    }

    // 2. Если в ноде есть script или js
    const anyNode = node as any;
    const directScript = anyNode.script || anyNode.js;
    if (typeof directScript === "string" && directScript.trim()) {
      const code = directScript.trim();
      const componentMatch = /\/\*\s*@component:\s*\.?([a-zA-Z0-9_-]+)/.exec(
        code,
      );
      const scriptName = componentMatch ? componentMatch[1] : targetName;

      extractedScripts.push({ name: scriptName, code });
    }

    // 3. Если есть инлайн стили — вытаскиваем в SCSS
    if (node.style && node.style.trim()) {
      const cleanBody = sanitizeCssBody(node.style);

      let targetClass = classList.find(
        (c) =>
          !c.includes(":") && !c.startsWith("flex") && !c.startsWith("grid"),
      );

      if (!targetClass) {
        targetClass = `${tag.replace(/[^a-z0-9]/g, "")}-${key.slice(-5)}`;
        classList.push(targetClass);
      }

      extractedRules.push(`.${targetClass} {\n  ${cleanBody}\n}`);
    }

    // Рекурсивно обходим дочерние элементы
    let processedChildren: HtmlNode[] = [];
    if (Array.isArray(node.children)) {
      processedChildren = node.children
        .map(processNode)
        .filter(Boolean) as HtmlNode[];
    }

    const cleaned: any = {
      ...node,
      _key: key,
      class: classList.length > 0 ? classList.join(" ") : undefined,
      children: processedChildren,
    };
    delete cleaned.style;
    delete cleaned.script;
    delete cleaned.js;

    return cleaned;
  }

  const cleanNodes = nodes.map(processNode).filter(Boolean) as HtmlNode[];
  return {
    cleanNodes,
    extractedScss: extractedRules.join("\n\n"),
    extractedScripts,
  };
}

function isRowContainer(node: HtmlNode): boolean {
  const raw = (node.class || "").toLowerCase();
  const cls = raw.replace(/[-_]/g, " ");

  if (
    raw.includes("flex-col") ||
    raw.includes("flex-column") ||
    cls.includes("flex col") ||
    cls.includes("flex column")
  ) {
    return false;
  }

  if (
    raw.includes("flex-row") ||
    cls.includes("flex row") ||
    raw.includes("ul-flex-row") ||
    raw.includes("grid")
  ) {
    return true;
  }

  return raw.includes("flex");
}

const DEPTH_BG = [
  "rgba(18, 18, 24, 0.96)",
  "rgba(26, 26, 34, 0.96)",
  "rgba(34, 34, 44, 0.96)",
  "rgba(42, 42, 54, 0.96)",
  "rgba(50, 50, 64, 0.96)",
];

const DEPTH_BORDER = [
  "rgba(63, 63, 70, 0.8)",
  "rgba(82, 82, 91, 0.85)",
  "rgba(113, 113, 122, 0.9)",
  "rgba(161, 161, 170, 0.9)",
  "rgba(212, 212, 216, 0.9)",
];

const COMMON_TAGS = [
  "div",
  "p",
  "span",
  "button",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "section",
  "header",
  "footer",
  "main",
  "nav",
  "aside",
  "article",
  "ul",
  "ol",
  "li",
  "input",
  "form",
  "label",
  "img",
];

interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside";
}

function DropGap({
  targetKey,
  position,
  orientation = "horizontal",
  draggedKey,
  dropTarget,
}: {
  targetKey: string;
  position: "before" | "after";
  orientation?: "horizontal" | "vertical";
  draggedKey: string | null;
  dropTarget: DropTarget | null;
}) {
  const isTarget =
    Boolean(draggedKey) &&
    dropTarget?.key === targetKey &&
    dropTarget?.position === position;

  const isVert = orientation === "vertical";

  return (
    <div
      data-gap-key={targetKey}
      data-gap-pos={position}
      className={`relative select-none flex items-center justify-center cursor-default shrink-0 ${
        isVert ? "w-2 h-full min-h-[30px] self-stretch" : "h-2 w-full"
      }`}
    >
      {draggedKey && (
        <div
          className={`absolute pointer-events-none z-20 ${
            isVert ? "inset-y-0 -left-1 -right-1" : "inset-x-0 -top-1 -bottom-1"
          }`}
        />
      )}

      {isTarget && (
        <div
          className={`absolute flex items-center pointer-events-none z-30 ${
            isVert ? "inset-y-0 flex-col" : "inset-x-0 flex-row"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] shrink-0" />
          <div
            className={`bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8] ${
              isVert ? "w-[2px] flex-1" : "h-[2px] flex-1"
            }`}
          />
        </div>
      )}
    </div>
  );
}

function NodeCard({
  node,
  depth,
  parentIsRow = false,
  draggedKey,
  dropTarget,
  collapsedKeys,
  clickedKey,
  hoveredKey,
  onPointerDownNode,
  onClickNode,
  onDoubleClickNode,
  onToggleCollapse,
  onHoverNode,
}: any) {
  const key = node._key || "";
  const children = Array.isArray(node.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const isCollapsed = collapsedKeys.has(key);

  const isDragged = draggedKey === key;
  const isHovered = hoveredKey === key;
  const isClicked = clickedKey === key;
  const isDrop = dropTarget?.key === key;
  const dropPos = isDrop ? dropTarget?.position : null;

  const depthIdx = Math.min(depth, DEPTH_BG.length - 1);
  const isRow = isRowContainer(node);

  let borderStyle = DEPTH_BORDER[depthIdx];
  let bgStyle = DEPTH_BG[depthIdx];
  let shadowStyle = `0 1px 3px rgba(0, 0, 0, 0.4)`;

  if (isDrop && dropPos === "self") {
    borderStyle = "#c084fc";
    bgStyle = "rgba(168, 85, 247, 0.22)";
    shadowStyle = "0 0 12px rgba(192, 132, 252, 0.4)";
  } else if (isDrop && dropPos === "inside") {
    borderStyle = "#38bdf8";
    bgStyle = "rgba(56, 189, 248, 0.16)";
    shadowStyle = "0 0 10px rgba(56, 189, 248, 0.4)";
  } else if (isClicked) {
    borderStyle = "#818cf8";
    bgStyle = "rgba(99, 102, 241, 0.2)";
    shadowStyle = "0 0 10px rgba(129, 140, 248, 0.35)";
  } else if (isHovered && !draggedKey) {
    borderStyle = "#a5b4fc";
    bgStyle = "rgba(99, 102, 241, 0.1)";
  }

  const tagLower = (node.tag || "div").toLowerCase();
  let tagBadgeClass = "bg-zinc-800/80 border-zinc-600/80 text-zinc-200";
  if (tagLower === "div") {
    tagBadgeClass = "bg-indigo-950/80 border-indigo-500/80 text-indigo-200";
  } else if (tagLower === "p") {
    tagBadgeClass = "bg-emerald-950/80 border-emerald-500/80 text-emerald-200";
  } else if (["section", "header", "footer"].includes(tagLower)) {
    tagBadgeClass = "bg-amber-950/80 border-amber-500/80 text-amber-200";
  }

  const hasClass = Boolean(node.class && node.class.trim());
  const classStr = hasClass
    ? "." + node.class!.trim().replace(/\s+/g, " .")
    : "";
  const hasText = Boolean(node.text && node.text.trim());

  return (
    <div
      data-node-key={key}
      data-is-row={parentIsRow ? "true" : "false"}
      onPointerEnter={(e) => {
        e.stopPropagation();
        onHoverNode(key);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        onHoverNode(null);
      }}
      onPointerDown={(e) => {
        if (e.button === 0) {
          e.stopPropagation();
          onPointerDownNode(e, key);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClickNode(key);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClickNode(key);
      }}
      className={`relative rounded-md select-none border transition-all box-border min-h-[30px] flex flex-col cursor-grab active:cursor-grabbing ${
        isDragged ? "opacity-35 border-dashed" : "opacity-100"
      } ${parentIsRow ? "flex-1 min-w-[120px]" : "w-full"}`}
      style={{
        backgroundColor: bgStyle,
        borderColor: borderStyle,
        boxShadow: shadowStyle,
      }}
    >
      <div className="h-[28px] px-2 flex items-center justify-between gap-1 rounded-t-md border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {hasChildren && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(key);
              }}
              className="w-4 h-4 rounded bg-zinc-900/90 border border-zinc-700 hover:border-zinc-500 text-cyan-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 transition"
            >
              {isCollapsed ? "+" : "−"}
            </button>
          )}

          <span
            className={`px-1.5 py-0.5 rounded text-[12px] tracking-tight border uppercase shrink-0 leading-none ${tagBadgeClass}`}
          >
            {node.tag || "div"}
          </span>

          {hasClass && (
            <span
              className="text-[12px] font-mono text-green-300 truncate max-w-[200px] leading-none"
              title={classStr}
            >
              {classStr}
            </span>
          )}

          {hasText && (
            <span
              className="text-[11px] text-zinc-200 truncate max-w-[180px] font-sans leading-none"
              title={node.text}
            >
              &quot;{node.text}&quot;
            </span>
          )}
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div
          className={`pl-2 w-full flex-1 relative ${
            isRow
              ? "flex flex-row flex-nowrap items-stretch gap-1 overflow-x-auto pb-2"
              : "flex flex-col gap-1 px-1 border-l border-zinc-700/60"
          }`}
        >
          {children.map((child: HtmlNode, idx: number) => (
            <React.Fragment key={child._key || idx}>
              {idx === 0 && (
                <DropGap
                  targetKey={child._key || ""}
                  position="before"
                  orientation={isRow ? "vertical" : "horizontal"}
                  draggedKey={draggedKey}
                  dropTarget={dropTarget}
                />
              )}
              <NodeCard
                node={child}
                depth={depth + 1}
                parentIsRow={isRow}
                draggedKey={draggedKey}
                dropTarget={dropTarget}
                collapsedKeys={collapsedKeys}
                clickedKey={clickedKey}
                hoveredKey={hoveredKey}
                onPointerDownNode={onPointerDownNode}
                onClickNode={onClickNode}
                onDoubleClickNode={onDoubleClickNode}
                onToggleCollapse={onToggleCollapse}
                onHoverNode={onHoverNode}
              />
              <DropGap
                targetKey={child._key || ""}
                position="after"
                orientation={isRow ? "vertical" : "horizontal"}
                draggedKey={draggedKey}
                dropTarget={dropTarget}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentJson, setCurrentJson] = useState<HtmlNode[]>([]);
  const currentJsonRef = useRef<HtmlNode[]>([]);
  currentJsonRef.current = currentJson;

  const historyRef = useRef<HtmlNode[][]>([]);
  const futureRef = useRef<HtmlNode[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickedKey, setClickedKey] = useState<string | null>(null);

  const [editTag, setEditTag] = useState<string>("div");
  const [editClass, setEditClass] = useState<string>("");
  const [editText, setEditText] = useState<string>("");
  let selectedNode: HtmlNode | null = null;
  if (clickedKey) {
    for (const r of currentJson) {
      const f = findNodeByKey(r, clickedKey);
      if (f) {
        selectedNode = f;
        break;
      }
    }
  }

  useEffect(() => {
    if (selectedNode) {
      setEditTag(selectedNode.tag || "div");
      setEditClass(selectedNode.class || "");
      setEditText(selectedNode.text || "");
    }
  }, [
    clickedKey,
    selectedNode?._key,
    selectedNode?.tag,
    selectedNode?.class,
    selectedNode?.text,
  ]);

  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const draggedKeyRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  dropTargetRef.current = dropTarget;

  const [dragMousePos, setDragMousePos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const potentialDragKeyRef = useRef<string | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef<boolean>(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ГЛОБАЛЬНЫЙ SCSS
  const [globalScss, setGlobalScss] = useState<string>("");
  const globalScssRef = useRef<string>("");
  globalScssRef.current = globalScss;

  // ГЛОБАЛЬНЫЙ JS БАНДЛ
  const [globalJs, setGlobalJs] = useState<string>("");
  const globalJsRef = useRef<string>("");
  globalJsRef.current = globalJs;

  // Сохранение SCSS в IndexedDB
  const updateAndPersistScss = async (nextScss: string) => {
    try {
      await saveGlobalScss(nextScss);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: nextScss }),
      );
    } catch (e) {
      console.error("[CanvasArea] Error saving SCSS to DB:", e);
    }
  };

  // Сохранение JS в IndexedDB
  const updateAndPersistJs = async (nextJs: string) => {
    try {
      await saveGlobalJs(nextJs);
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: nextJs }),
      );
    } catch (e) {
      console.error("[CanvasArea] Error saving JS to DB:", e);
    }
  };

  /* ==========================================================================
     ПЕРВОНАЧАЛЬНАЯ ЗАГРУЗКА ИЗ INDEXEDDB: СОБИРАЕМ ВСЁ
     ========================================================================== */
  useEffect(() => {
    (async () => {
      try {
        const [dbScss, dbJs, data] = await Promise.all([
          getGlobalScss().catch(() => ""),
          getGlobalJs().catch(() => ""),
          getHtmlJson(DB_KEY).catch(() => null),
        ]);

        let currentScss = dbScss || "";
        let currentJs = dbJs || "";

        if (data) {
          const list = Array.isArray(data) ? data : [data];
          // Вытаскиваем и стили, и скрипты из нод при загрузке
          const { cleanNodes, extractedScss, extractedScripts } =
            extractStylesAndScriptsFromNodes(list);

          if (extractedScss) {
            currentScss = currentScss
              ? `${currentScss}\n\n${extractedScss}`
              : extractedScss;
          }

          if (extractedScripts.length > 0) {
            for (const s of extractedScripts) {
              currentJs = updateScriptInGlobalBundle(currentJs, s.name, s.code);
            }
          }

          setCurrentJson(cleanNodes);
          currentJsonRef.current = cleanNodes;

          await Promise.all([
            updateAndPersistScss(currentScss),
            updateAndPersistJs(currentJs),
            saveHtmlJson(DB_KEY, cleanNodes),
          ]);
        } else {
          setCurrentJson([]);
          currentJsonRef.current = [];
          await Promise.all([
            updateAndPersistScss(currentScss),
            updateAndPersistJs(currentJs),
          ]);
        }
      } catch (err) {
        console.error("[CanvasArea] Mount load error:", err);
      }
    })();
  }, []);

  // Слушаем внешние стили (ModalCss)
  useEffect(() => {
    const handleExternalStyles = (e: Event) => {
      const customEvent = e as CustomEvent<string | Record<string, string>>;
      let nextScss = "";
      if (typeof customEvent.detail === "string") {
        nextScss = customEvent.detail;
      } else if (customEvent.detail && typeof customEvent.detail === "object") {
        nextScss = Object.values(customEvent.detail).join("\n\n");
      }
      setGlobalScss(nextScss);
      globalScssRef.current = nextScss;
    };

    window.addEventListener("plaza-styles-updated", handleExternalStyles);
    return () =>
      window.removeEventListener("plaza-styles-updated", handleExternalStyles);
  }, []);

  // Слушаем внешние скрипты (ModalJs)
  useEffect(() => {
    const handleExternalScripts = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const nextJs =
        typeof customEvent.detail === "string" ? customEvent.detail : "";
      setGlobalJs(nextJs);
      globalJsRef.current = nextJs;
    };

    window.addEventListener("plaza-scripts-updated", handleExternalScripts);
    return () =>
      window.removeEventListener(
        "plaza-scripts-updated",
        handleExternalScripts,
      );
  }, []);

  // СОХРАНЕНИЕ СКРИПТА НОДЫ: СРАЗУ ВШИВАЕТСЯ В БАНДЛ И В БАЗУ
  const handleSaveScriptJs = async (targetName: string, jsCode: string) => {
    const nextBundle = updateScriptInGlobalBundle(
      globalJsRef.current,
      targetName,
      jsCode,
    );
    await updateAndPersistJs(nextBundle);
  };

  const handleAddClassToNode = async (newCls: string) => {
    const clean = newCls.trim().replace(/^\./, "");
    if (!clean || !clickedKey || !selectedNode) return;

    const currentClasses = (selectedNode.class || "")
      .split(/\s+/)
      .filter(Boolean);
    if (!currentClasses.includes(clean)) {
      const updatedClassStr = [...currentClasses, clean].join(" ");
      setEditClass(updatedClassStr);
      await handleSaveNodeField("class", updatedClassStr);
    }
  };

  const persist = async (next: HtmlNode[], recordHistory = true) => {
    if (recordHistory) {
      const snapshot = JSON.parse(JSON.stringify(currentJsonRef.current));
      historyRef.current = [...historyRef.current.slice(-49), snapshot];
      futureRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    }

    setCurrentJson(next);
    currentJsonRef.current = next;

    try {
      if (next.length > 0) {
        await saveHtmlJson(DB_KEY, next);
      } else {
        await deleteHtmlJson(DB_KEY);
      }
      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", { detail: next }),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleUndo = useCallback(async () => {
    if (historyRef.current.length === 0) return;
    const previousState = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [
      JSON.parse(JSON.stringify(currentJsonRef.current)),
      ...futureRef.current,
    ];
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    await persist(previousState, false);
  }, []);

  const handleRedo = useCallback(async () => {
    if (futureRef.current.length === 0) return;
    const nextState = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    historyRef.current = [
      ...historyRef.current.slice(-49),
      JSON.parse(JSON.stringify(currentJsonRef.current)),
    ];
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
    await persist(nextState, false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;
      const key = e.key.toLowerCase();
      if ((key === "z" || key === "я") && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((key === "z" || key === "я") && e.shiftKey) ||
        key === "y" ||
        key === "н"
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  /* ==========================================================================
     ДОБАВЛЕНИЕ ЭЛЕМЕНТА ИЗ ПАНЕЛИ: СРАЗУ ЗАБИРАЕМ ЕГО СКРИПТЫ И СТИЛИ В БАЗУ
     ========================================================================== */
  const handleAppendFromPath = async (path: string) => {
    try {
      const res = await fetch(path);
      if (!res.ok) return;
      const raw = await res.json();
      const nodes: HtmlNode[] = Array.isArray(raw) ? raw : [raw];

      // Вытаскиваем и стили, и скрипты
      const { cleanNodes, extractedScss, extractedScripts } =
        extractStylesAndScriptsFromNodes(nodes);

      // Сразу обновляем SCSS бандл в базе
      if (extractedScss) {
        const nextScss = globalScssRef.current
          ? `${globalScssRef.current}\n\n${extractedScss}`
          : extractedScss;
        await updateAndPersistScss(nextScss);
      }

      // СРАЗУ ОБНОВЛЯЕМ JS БАНДЛ В БАЗЕ
      if (extractedScripts.length > 0) {
        let bundle = globalJsRef.current;
        for (const s of extractedScripts) {
          bundle = updateScriptInGlobalBundle(bundle, s.name, s.code);
        }
        await updateAndPersistJs(bundle);
      }

      // Сохраняем разметку
      const next = [...currentJsonRef.current, ...cleanNodes];
      await persist(next);
    } catch (e) {
      console.error(`Error adding from ${path}:`, e);
    }
  };

  const handleClear = async () => {
    await persist([]);
    setClickedKey(null);
    setHoveredKey(null);
  };

  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  };

  const handlePointerDownNode = (e: React.PointerEvent, key: string) => {
    if (e.button !== 0) return;
    potentialDragKeyRef.current = key;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
  };

  const handleToggleCollapse = (key: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleClickNode = (key: string) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      setClickedKey(key);
      clickTimeoutRef.current = null;
    }, 200);
  };

  const handleDoubleClickNode = async (key: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    const next = deleteNodeFromArray(currentJsonRef.current, key);
    if (clickedKey === key) setClickedKey(null);
    if (hoveredKey === key) setHoveredKey(null);
    await persist(next);
  };

  const handleSaveNodeField = async (
    field: "tag" | "class" | "text" | "attributes",
    value: any,
  ) => {
    if (!clickedKey) return;
    const patch: Partial<HtmlNode> = { [field]: value };
    const next = currentJsonRef.current.map((root) =>
      updateNodeByKey(root, clickedKey, patch),
    );
    await persist(next);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (potentialDragKeyRef.current && dragStartPosRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 4) {
          draggedKeyRef.current = potentialDragKeyRef.current;
          setDraggedKey(potentialDragKeyRef.current);
          potentialDragKeyRef.current = null;
          hasDraggedRef.current = true;
        }
      }

      const activeDragKey = draggedKeyRef.current;
      if (!activeDragKey) return;

      setDragMousePos({ x: e.clientX, y: e.clientY });

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length === 0) {
        dropTargetRef.current = null;
        setDropTarget(null);
        return;
      }

      const gapEl = elements
        .map((el) => el.closest("[data-gap-key]"))
        .find(Boolean) as HTMLElement | undefined;
      if (gapEl) {
        const key = gapEl.getAttribute("data-gap-key")!;
        const position = gapEl.getAttribute("data-gap-pos") as
          "before" | "after";
        if (key === activeDragKey) {
          dropTargetRef.current = null;
          setDropTarget(null);
          return;
        }
        const nextTarget: DropTarget = { key, position };
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
        return;
      }

      const cardEl = elements
        .map((el) => el.closest("[data-node-key]"))
        .find(Boolean) as HTMLElement | undefined;
      if (cardEl) {
        const key = cardEl.getAttribute("data-node-key")!;
        const isParentRow = cardEl.getAttribute("data-is-row") === "true";

        if (key === activeDragKey) {
          const nextTarget: DropTarget = {
            key: activeDragKey,
            position: "self",
          };
          dropTargetRef.current = nextTarget;
          setDropTarget(nextTarget);
          return;
        }

        let sourceNode: HtmlNode | null = null;
        for (const root of currentJsonRef.current) {
          const found = findNodeByKey(root, activeDragKey);
          if (found) {
            sourceNode = found;
            break;
          }
        }
        if (sourceNode && isDescendant(sourceNode, key)) {
          dropTargetRef.current = null;
          setDropTarget(null);
          return;
        }

        const rect = cardEl.getBoundingClientRect();
        let position: "before" | "inside" | "after" = "inside";

        if (isParentRow) {
          const relX = (e.clientX - rect.left) / rect.width;
          if (relX < 0.25) position = "before";
          else if (relX > 0.75) position = "after";
          else position = "inside";
        } else {
          const relY = (e.clientY - rect.top) / rect.height;
          if (relY < 0.25) position = "before";
          else if (relY > 0.75) position = "after";
          else position = "inside";
        }

        const nextTarget: DropTarget = { key, position };
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
        return;
      }

      const workspaceEl = elements
        .map((el) => el.closest(".plaza-workspace"))
        .find(Boolean);
      if (workspaceEl && currentJsonRef.current.length > 0) {
        const lastRoot =
          currentJsonRef.current[currentJsonRef.current.length - 1];
        const nextTarget: DropTarget = {
          key: lastRoot._key || "",
          position: "after",
        };
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
        return;
      }

      dropTargetRef.current = null;
      setDropTarget(null);
    };

    const handlePointerUp = async () => {
      const activeDragKey = draggedKeyRef.current;
      const target = dropTargetRef.current;

      draggedKeyRef.current = null;
      setDraggedKey(null);
      dropTargetRef.current = null;
      setDropTarget(null);
      setDragMousePos(null);
      potentialDragKeyRef.current = null;
      dragStartPosRef.current = null;

      if (hasDraggedRef.current)
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 50);

      if (activeDragKey && target && target.key) {
        if (target.position === "self") {
          const updated = duplicateNodeInTree(
            currentJsonRef.current,
            activeDragKey,
          );
          await persist(updated);
        } else {
          const updated = moveNodePosition(
            currentJsonRef.current,
            activeDragKey,
            target.key,
            target.position,
          );
          await persist(updated);
        }
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  let draggedNode: HtmlNode | null = null;
  if (draggedKey) {
    for (const r of currentJson) {
      const f = findNodeByKey(r, draggedKey);
      if (f) {
        draggedNode = f;
        break;
      }
    }
  }

  return (
    <div className="w-full flex gap-1 h-[calc(100vh-80px)] min-h-[500px] select-none">
      <aside className="w-48 shrink-0 bg-zinc-900 border border-zinc-800 rounded-sm p-1 flex flex-col justify-between shadow-xl select-none overflow-hidden">
        <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
          {currentJson.length > 0 && (
            <div>
              <button type="button" onClick={handleClear} className="red-btn">
                Clear
              </button>
            </div>
          )}
          <div className="space-y-1 border-b border-zinc-800 pb-2">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="grey-btn"
              >
                <span>↶</span> Undo
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className="grey-btn"
              >
                <span>↷</span> Redo
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {ELEMENT_FOLDERS.map((folder) => {
              const isOpen = openFolders.has(folder.name);
              return (
                <div key={folder.name} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.name)}
                    className="admin-btn !justify-between"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{isOpen ? "📂" : "📁"}</span>
                      <span className="font-mono">{folder.name}</span>
                    </span>
                    <span className="text-[12px] text-zinc-500 font-mono">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, y: 0 }}
                        animate={{ height: "auto", opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="pl-3 py-0.5 space-y-1 border-l border-zinc-800/80"
                      >
                        <div className="flex flex-col gap-1">
                          {folder.items.map((item) => (
                            <button
                              type="button"
                              key={item.path}
                              onClick={() => handleAppendFromPath(item.path)}
                              className="admin-btn"
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="space-y-1 pt-1.5 border-t border-zinc-800">
            <div className="grid grid-cols-2 gap-1">
              {ROOT_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag.path}
                  onClick={() => handleAppendFromPath(tag.path)}
                  className="admin-btn"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div
        ref={containerRef}
        className="plaza-workspace flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl "
      >
        <div className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1 pb-[500px]">
          {currentJson.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-zinc-500 gap-2">
              <span className="text-3xl">🧩</span>
              <p className="text-sm font-medium">Canvas is empty</p>
            </div>
          ) : (
            <div className="w-full mx-auto flex flex-col min-h-full">
              {currentJson.map((node, index) => (
                <React.Fragment key={node._key || index}>
                  {index === 0 && (
                    <DropGap
                      targetKey={node._key || ""}
                      position="before"
                      orientation="horizontal"
                      draggedKey={draggedKey}
                      dropTarget={dropTarget}
                    />
                  )}
                  <NodeCard
                    node={node}
                    depth={0}
                    parentIsRow={false}
                    draggedKey={draggedKey}
                    dropTarget={dropTarget}
                    collapsedKeys={collapsedKeys}
                    clickedKey={clickedKey}
                    hoveredKey={hoveredKey}
                    onPointerDownNode={handlePointerDownNode}
                    onClickNode={handleClickNode}
                    onDoubleClickNode={handleDoubleClickNode}
                    onToggleCollapse={handleToggleCollapse}
                    onHoverNode={setHoveredKey}
                  />
                  <DropGap
                    targetKey={node._key || ""}
                    position="after"
                    orientation="horizontal"
                    draggedKey={draggedKey}
                    dropTarget={dropTarget}
                  />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Редактор ноды */}
        <AnimatePresence>
          {clickedKey && selectedNode && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: 0 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: 0 }}
              transition={{ duration: 0.1, ease: "easeInOut" }}
              className={`fixed shadow-[0_-6px_18px_rgba(32,75,110,0.7)] bottom-0 right-0 w-[calc(100vw-210px)] z-40 transition-transform duration-300 ease-in-out ${
                clickedKey ? "translate-y-0" : "translate-y-full"
              }`}
            >
              <div className="relative bg-zinc-800 border-t border-zinc-700 rounded-t-sm shadow-[0_-8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClickedKey(null);
                  }}
                  className="absolute top-1 left-2 z-50 w-10 h-4.5 rounded-lg bg-red-600 hover:bg-red-500 border-2 border-red-400 text-white text-sm font-bold flex items-center justify-center shadow transition-all cursor-pointer"
                >
                  ✕
                </button>

                <div className="p-1 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] pl-15 font-mono text-zinc-500 uppercase tracking-widest">
                      Editing
                    </span>
                    <span className="text-[11px] font-mono text-emerald-300 truncate max-w-[200px]">
                      &lt;{selectedNode.tag || "div"}&gt;
                      {selectedNode.class
                        ? ` .${selectedNode.class.split(" ")[0]}`
                        : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-[10px] tracking-widest text-zinc-400 block">
                      Tag
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {COMMON_TAGS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={async () => {
                            setEditTag(t);
                            await handleSaveNodeField("tag", t);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                            editTag === t
                              ? "bg-indigo-600 border-indigo-400 text-white shadow"
                              : "bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-indigo-500 hover:text-indigo-300"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_2fr] gap-2 items-start mt-2">
                    <div>
                      <label className="text-[10px] tracking-widest text-zinc-400 block">
                        Classes
                      </label>
                      <input
                        type="text"
                        value={editClass}
                        onChange={(e) => setEditClass(e.target.value)}
                        onBlur={async (e) => {
                          await handleSaveNodeField("class", e.target.value);
                        }}
                        placeholder="flex items-center gap-2..."
                        className="w-full px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-600 text-green-300 text-[14px] placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 block">
                        Text
                      </label>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={async (e) => {
                          await handleSaveNodeField("text", e.target.value);
                        }}
                        rows={3}
                        placeholder="Text content..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-100 text-[12px] font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800">
                    {(() => {
                      const classSource =
                        editClass !== undefined && editClass !== null
                          ? editClass
                          : selectedNode.class || "";
                      const nodeClasses = classSource
                        .split(/\s+/)
                        .map((c) => c.trim().replace(/^\./, ""))
                        .filter(Boolean);

                      return (
                        <MonacoPropertiesEditor
                          nodeKey={selectedNode._key || ""}
                          nodeTag={selectedNode.tag || "div"}
                          nodeClasses={nodeClasses}
                          globalScss={globalScss}
                          globalJs={globalJs}
                          attributesValue={selectedNode.attributes}
                          onSaveGlobalScss={updateAndPersistScss}
                          onSaveScriptJs={handleSaveScriptJs}
                          onSaveAttributes={async (newAttrs) => {
                            await handleSaveNodeField("attributes", newAttrs);
                          }}
                          onAddClassToNode={handleAddClassToNode}
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 👻 ПРИЗРАК ПЕРЕТАСКИВАЕМОГО УЗЛА (следует за курсором) */}
      {draggedNode && dragMousePos && (
        <div
          style={{
            position: "fixed",
            left: dragMousePos.x + 14,
            top: dragMousePos.y + 14,
            pointerEvents: "none",
            zIndex: 99999,
          }}
          className="px-2.5 py-1 rounded-md bg-indigo-950/90 border border-indigo-400 text-white shadow-2xl flex items-center gap-2 backdrop-blur-sm select-none"
        >
          <span className="px-1.5 py-0.5 rounded text-[11px] font-mono uppercase bg-indigo-900 border border-indigo-500 text-indigo-200 leading-none">
            {draggedNode.tag || "div"}
          </span>

          {draggedNode.class && (
            <span className="text-[11px] font-mono text-green-300 max-w-[140px] truncate leading-none">
              .{draggedNode.class.trim().replace(/\s+/g, " .")}
            </span>
          )}

          {draggedNode.text && (
            <span className="text-[11px] text-zinc-300 max-w-[100px] truncate leading-none font-sans">
              &quot;{draggedNode.text}&quot;
            </span>
          )}
        </div>
      )}
    </div>
  );
}
