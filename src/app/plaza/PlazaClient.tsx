"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HtmlNode } from "@/types/htmlJson";
import {
  addChildNode,
  createNode,
  deleteNodeByKey,
  findNodeByKey,
  treeToHtml,
  updateNodeByKey,
} from "@/lib/htmlTree";
import {
  deleteHtmlJson,
  getHtmlJson,
  saveHtmlJson,
} from "@/lib/htmlStorage";
import { HtmlRenderer } from "@/components/HtmlRenderer";
import { modal } from "@/lib/modal";

const STORAGE_KEY = "plaza_tree";

export function PlazaClient() {
  const [tree, setTree] = useState<HtmlNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"render" | "tree" | "json">("render");

  // Состояния для модальных окон Create / Edit узлов
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [addingToKey, setAddingToKey] = useState<string | null>(null);

  const [formTag, setFormTag] = useState("div");
  const [formText, setFormText] = useState("");
  const [formClass, setFormClass] = useState("");
  const [formStyle, setFormStyle] = useState("");

  // Чтение из IndexedDB при монтировании (изначально в базе пустота)
  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    try {
      setLoading(true);
      const data = await getHtmlJson(STORAGE_KEY);
      setTree(data); // null если база пуста
    } catch (e: any) {
      modal.error("IndexedDB Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // Сохранение изменений в IndexedDB
  const persistTree = async (newTree: HtmlNode | null) => {
    setTree(newTree);
    try {
      if (newTree) {
        await saveHtmlJson(STORAGE_KEY, newTree);
      } else {
        await deleteHtmlJson(STORAGE_KEY);
      }
    } catch (e: any) {
      modal.error("Save Error", e.message);
    }
  };

  // ==========================================================================
  // CREATE
  // ==========================================================================

  // Создание первого корневого узла (когда база пуста)
  const handleCreateRoot = async () => {
    const rootNode = createNode({
      tag: "div",
      class: "p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 space-y-4",
      children: [
        createNode({
          tag: "h1",
          text: "Welcome to Plaza",
          class: "text-2xl font-bold text-indigo-400",
          children: [],
        }),
        createNode({
          tag: "p",
          text: "This HTML is rendered directly from your IndexedDB htmlJson tree.",
          class: "text-zinc-300 text-sm",
          children: [],
        }),
      ],
    });
    await persistTree(rootNode);
    modal.success("Created", "Root htmlJson created in IndexedDB");
  };

  // Открыть форму добавления дочернего узла
  const handleOpenAddChild = (parentKey: string) => {
    setAddingToKey(parentKey);
    setFormTag("div");
    setFormText("New child");
    setFormClass("p-3 bg-zinc-800/80 rounded-lg text-sm text-zinc-200 border border-zinc-700/60");
    setFormStyle("");
  };

  // Подтвердить добавление дочернего узла
  const submitAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tree || !addingToKey) return;

    const child = createNode({
      tag: formTag.trim() || "div",
      text: formText,
      class: formClass,
      style: formStyle,
      children: [],
    });

    const updated = addChildNode(tree, addingToKey, child);
    await persistTree(updated);
    setAddingToKey(null);
    modal.success("Added", `<${child.tag}> added to tree`);
  };

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  const handleOpenEdit = (node: HtmlNode) => {
    setEditingKey(node._key || null);
    setFormTag(node.tag);
    setFormText(node.text || "");
    setFormClass(node.class || "");
    setFormStyle(node.style || "");
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tree || !editingKey) return;

    const updated = updateNodeByKey(tree, editingKey, {
      tag: formTag.trim(),
      text: formText,
      class: formClass,
      style: formStyle,
    });

    await persistTree(updated);
    setEditingKey(null);
    modal.success("Updated", "Node updated in IndexedDB");
  };

  // ==========================================================================
  // DELETE
  // ==========================================================================

  const handleDeleteNode = async (key: string) => {
    if (!tree) return;
    if (tree._key === key) {
      const confirmClear = await modal.confirm(
        "Delete Root?",
        "Deleting the root node will completely empty IndexedDB. Proceed?"
      );
      if (confirmClear) {
        await persistTree(null);
        modal.info("Cleared", "IndexedDB is now empty");
      }
      return;
    }

    const updated = deleteNodeByKey(tree, key);
    await persistTree(updated);
    modal.info("Deleted", "Node deleted from tree");
  };

  const handleClearAll = async () => {
    const ok = await modal.confirm(
      "Clear IndexedDB?",
      "Are you sure you want to delete the whole htmlJson tree from IndexedDB?"
    );
    if (!ok) return;

    await persistTree(null);
    modal.info("Emptied", "IndexedDB is now completely empty");
  };

  // Рендер пустого состояния (когда в базе пустота)
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-12 text-center text-zinc-400">
        Loading IndexedDB...
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="w-full max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-2xl font-mono text-zinc-400">
          ∅
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            IndexedDB is empty
          </h2>
          <p className="text-zinc-400 text-sm">
            В локальной базе браузера нет сущности htmlJson. Создайте корневой узел для начала работы.
          </p>
        </div>
        <div>
          <button
            onClick={handleCreateRoot}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg cursor-pointer"
          >
            + Create Root htmlJson
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Панель управления Plaza */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase font-mono font-bold px-2.5 py-1 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
            Plaza Renderer
          </span>
          <div className="flex bg-zinc-800 p-1 rounded-lg border border-zinc-700 text-xs font-medium">
            <button
              onClick={() => setViewMode("render")}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === "render"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Live Render
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === "tree"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Tree CRUD
            </button>
            <button
              onClick={() => setViewMode("json")}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === "json"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              htmlJson
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddChild(tree._key || "")}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer"
          >
            + Add to Root
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/80 text-red-300 text-xs font-medium transition cursor-pointer"
          >
            Clear DB
          </button>
        </div>
      </div>

      {/* 1. Live Rendering страницы plaza */}
      {viewMode === "render" && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xl min-h-[300px]">
          <HtmlRenderer node={tree} />
        </div>
      )}

      {/* 2. Визуальное дерево с кнопками CRUD для каждого узла */}
      {viewMode === "tree" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4 font-mono">
            Interactive Tree Editor
          </h3>
          <PlazaNodeRow
            node={tree}
            isRoot={true}
            depth={0}
            onAddChild={handleOpenAddChild}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteNode}
          />
        </div>
      )}

      {/* 3. Сырой JSON контракт */}
      {viewMode === "json" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>IndexedDB Key: {STORAGE_KEY}</span>
            <span>Contract: HtmlNode</span>
          </div>
          <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-indigo-300 font-mono overflow-auto max-h-[500px]">
            {JSON.stringify(tree, null, 2)}
          </pre>
          <div className="pt-2">
            <span className="text-xs text-zinc-500 uppercase font-mono">Generated HTML:</span>
            <pre className="mt-1 p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-400 font-mono overflow-x-auto">
              {treeToHtml(tree)}
            </pre>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования или добавления узла */}
      {(editingKey || addingToKey) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">
              {addingToKey ? "Add Child Node" : "Edit HTML Node"}
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              {addingToKey ? "Create a new tag under selected node" : `Modifying node ${editingKey}`}
            </p>

            <form onSubmit={addingToKey ? submitAddChild : submitEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                    Tag
                  </label>
                  <input
                    type="text"
                    required
                    value={formTag}
                    onChange={(e) => setFormTag(e.target.value)}
                    placeholder="div, p, h2, button, span..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                    Text
                  </label>
                  <input
                    type="text"
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    placeholder="Text content..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Class
                </label>
                <input
                  type="text"
                  value={formClass}
                  onChange={(e) => setFormClass(e.target.value)}
                  placeholder="Tailwind or custom CSS classes"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Style
                </label>
                <input
                  type="text"
                  value={formStyle}
                  onChange={(e) => setFormStyle(e.target.value)}
                  placeholder="color: red; font-size: 16px;"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(null);
                    setAddingToKey(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition shadow cursor-pointer"
                >
                  Save Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PlazaNodeRow({
  node,
  isRoot,
  depth,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: HtmlNode;
  isRoot: boolean;
  depth: number;
  onAddChild: (key: string) => void;
  onEdit: (node: HtmlNode) => void;
  onDelete: (key: string) => void;
}) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  return (
    <div className={`space-y-2 ${depth > 0 ? "ml-4 sm:ml-6 pl-3 border-l border-zinc-800" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-750 transition">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
            &lt;{node.tag}&gt;
          </span>
          {node.text && (
            <span className="text-xs text-zinc-300 truncate max-w-[200px]">
              &quot;{node.text}&quot;
            </span>
          )}
          {node.class && (
            <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[150px]">
              .{node.class.split(" ").slice(0, 2).join(".")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onAddChild(node._key || "")}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-semibold transition cursor-pointer"
          >
            + Child
          </button>
          <button
            onClick={() => onEdit(node)}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition cursor-pointer"
          >
            ✎ Edit
          </button>
          <button
            onClick={() => onDelete(node._key || "")}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-950/80 text-red-400 text-xs font-medium transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {hasChildren && (
        <div className="space-y-2">
          {(node.children as HtmlNode[]).map((child) => (
            <PlazaNodeRow
              key={child._key}
              node={child}
              isRoot={false}
              depth={depth + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
