"use client";

import { useEffect, useState, useTransition } from "react";
import { HtmlDocument, HtmlNode } from "@/types/htmlJson";
import {
  addChildNode,
  countNodes,
  createDefaultTree,
  createNode,
  deleteNodeByKey,
  findNodeByKey,
  treeToHtml,
  updateNodeByKey,
} from "@/lib/htmlTree";
import {
  createHtmlDocument,
  deleteHtmlDocument,
  getActiveDocId,
  getAllHtmlDocuments,
  setActiveDocId,
  updateHtmlDocument,
} from "@/lib/htmlStorage";
import { modal } from "@/lib/modal";

/**
 * Интерактивный редактор и визуализатор htmlJson в IndexedDB
 */
export function HtmlJsonEditor() {
  const [documents, setDocuments] = useState<HtmlDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<HtmlDocument | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "preview" | "json">("tree");
  const [editingNodeKey, setEditingNodeKey] = useState<string | null>(null);
  const [addingChildToKey, setAddingChildToKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Состояние формы редактирования узла
  const [nodeForm, setNodeForm] = useState<{
    tag: string;
    text: string;
    class: string;
    style: string;
  }>({ tag: "div", text: "", class: "", style: "" });

  // Загрузка документов из IndexedDB при старте
  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    try {
      let docs = await getAllHtmlDocuments();
      if (docs.length === 0) {
        // Создаем первый демонстрационный документ, если база пуста
        const initialDoc: HtmlDocument = {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "doc_" + Date.now(),
          title: "Main Landing Template",
          root: createDefaultTree(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await createHtmlDocument(initialDoc);
        docs = [initialDoc];
      }

      setDocuments(docs);

      const savedActiveId = getActiveDocId();
      const current = docs.find((d) => d.id === savedActiveId) || docs[0];
      setActiveDoc(current);
      if (current) setActiveDocId(current.id);
    } catch (err: any) {
      console.error("Failed to load IndexedDB:", err);
      modal.error("IndexedDB Error", err?.message || "Failed to access browser storage");
    }
  };

  // Сохранение изменений активного документа в IndexedDB
  const saveDoc = async (updatedDoc: HtmlDocument) => {
    setActiveDoc(updatedDoc);
    try {
      await updateHtmlDocument(updatedDoc.id, {
        title: updatedDoc.title,
        root: updatedDoc.root,
      });
      // Обновляем список
      setDocuments((prev) =>
        prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
      );
    } catch (err: any) {
      modal.error("Save Error", "Could not save to IndexedDB: " + err.message);
    }
  };

  // CREATE: Создать новый документ
  const handleCreateDocument = async () => {
    const title = prompt("Enter template title:", `Template #${documents.length + 1}`);
    if (!title) return;

    try {
      const newDoc: HtmlDocument = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "doc_" + Date.now(),
        title: title.trim(),
        root: createDefaultTree(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await createHtmlDocument(newDoc);
      setDocuments((prev) => [newDoc, ...prev]);
      setActiveDoc(newDoc);
      setActiveDocId(newDoc.id);
      modal.success("Created", `Document "${newDoc.title}" created in IndexedDB`);
    } catch (e: any) {
      modal.error("Creation failed", e.message);
    }
  };

  // DELETE: Удалить активный документ
  const handleDeleteDocument = async () => {
    if (!activeDoc) return;
    const confirmed = await modal.confirm(
      "Delete Document?",
      `Are you sure you want to delete "${activeDoc.title}" from IndexedDB?`
    );
    if (!confirmed) return;

    try {
      await deleteHtmlDocument(activeDoc.id);
      const remaining = documents.filter((d) => d.id !== activeDoc.id);
      setDocuments(remaining);
      const next = remaining[0] || null;
      setActiveDoc(next);
      if (next) setActiveDocId(next.id);
      modal.info("Deleted", "Document removed from IndexedDB");
    } catch (e: any) {
      modal.error("Delete failed", e.message);
    }
  };

  // CREATE NODE: Добавить дочерний узел
  const handleAddChild = (parentKey: string) => {
    setAddingChildToKey(parentKey);
    setNodeForm({
      tag: "div",
      text: "New element",
      class: "p-3 bg-zinc-800/80 rounded-lg text-sm text-zinc-200 border border-zinc-700/60",
      style: "",
    });
  };

  const submitAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc || !addingChildToKey) return;

    const newNode = createNode({
      tag: nodeForm.tag.trim() || "div",
      text: nodeForm.text,
      class: nodeForm.class,
      style: nodeForm.style,
      children: [],
    });

    const newRoot = addChildNode(activeDoc.root, addingChildToKey, newNode);
    const updatedDoc = { ...activeDoc, root: newRoot };
    await saveDoc(updatedDoc);
    setAddingChildToKey(null);
    modal.success("Node Added", `<${newNode.tag}> added under parent`);
  };

  // EDIT NODE: Начать редактирование узла
  const handleStartEdit = (node: HtmlNode) => {
    setEditingNodeKey(node._key || null);
    setNodeForm({
      tag: node.tag,
      text: node.text || "",
      class: node.class || "",
      style: node.style || "",
    });
  };

  const submitEditNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc || !editingNodeKey) return;

    const newRoot = updateNodeByKey(activeDoc.root, editingNodeKey, {
      tag: nodeForm.tag.trim(),
      text: nodeForm.text,
      class: nodeForm.class,
      style: nodeForm.style,
    });

    const updatedDoc = { ...activeDoc, root: newRoot };
    await saveDoc(updatedDoc);
    setEditingNodeKey(null);
    modal.success("Node Updated", "Properties saved to IndexedDB");
  };

  // DELETE NODE: Удалить узел
  const handleDeleteNode = async (key: string) => {
    if (!activeDoc) return;
    if (activeDoc.root._key === key) {
      modal.warning("Root node", "Cannot delete the root node of the tree");
      return;
    }

    const newRoot = deleteNodeByKey(activeDoc.root, key);
    if (!newRoot) return;

    const updatedDoc = { ...activeDoc, root: newRoot };
    await saveDoc(updatedDoc);
    modal.info("Node Deleted", "Node removed from tree");
  };

  if (!activeDoc) {
    return (
      <div className="w-full max-w-5xl mx-auto p-8 bg-zinc-900 border border-zinc-800 rounded-2xl text-center">
        <p className="text-zinc-400">Loading IndexedDB store...</p>
      </div>
    );
  }

  const totalNodes = countNodes(activeDoc.root);
  const rawHtml = treeToHtml(activeDoc.root);

  return (
    <div className="w-full max-w-6xl mx-auto bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur">
      {/* Top Bar: Документы и действия */}
      <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-950/60">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" title="IndexedDB Connected" />
          <span className="text-xs uppercase font-mono tracking-wider text-zinc-400 font-semibold">
            IndexedDB: <span className="text-indigo-400 font-bold">htmlJson</span>
          </span>
          <select
            value={activeDoc.id}
            onChange={(e) => {
              const doc = documents.find((d) => d.id === e.target.value);
              if (doc) {
                setActiveDoc(doc);
                setActiveDocId(doc.id);
              }
            }}
            className="bg-zinc-850 bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({new Date(d.updatedAt).toLocaleTimeString()})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateDocument}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span> New Document
          </button>
          {documents.length > 1 && (
            <button
              onClick={handleDeleteDocument}
              className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/80 text-red-300 text-xs font-medium transition cursor-pointer"
            >
              Delete Document
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("tree")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === "tree"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tree View ({totalNodes} nodes)
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === "preview"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Live HTML Preview
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === "json"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Raw JSON Contract
          </button>
        </div>
        <div className="text-[11px] text-zinc-500 font-mono">
          Auto-saved to browser IndexedDB
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5">
        {activeTab === "tree" && (
          <div className="space-y-4">
            <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80">
              <NodeRow
                node={activeDoc.root}
                isRoot={true}
                depth={0}
                onAddChild={handleAddChild}
                onEdit={handleStartEdit}
                onDelete={handleDeleteNode}
              />
            </div>
          </div>
        )}

        {activeTab === "preview" && (
          <div className="space-y-3">
            <div className="text-xs text-zinc-400 flex items-center justify-between">
              <span>Simulated Browser View:</span>
              <span className="font-mono text-zinc-500">Rendered via DOM iframe/shadow</span>
            </div>
            <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-800 overflow-auto">
              <div
                dangerouslySetInnerHTML={{ __html: rawHtml }}
                className="w-full text-zinc-100"
              />
            </div>
            <div className="pt-2">
              <span className="text-xs text-zinc-500 uppercase font-mono">Generated HTML:</span>
              <pre className="mt-1 p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-400 font-mono overflow-x-auto">
                {rawHtml}
              </pre>
            </div>
          </div>
        )}

        {activeTab === "json" && (
          <div className="relative">
            <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-indigo-300 font-mono overflow-auto max-h-[500px]">
              {JSON.stringify(activeDoc.root, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Modal / Dialog: Редактирование / Добавление узла */}
      {(editingNodeKey || addingChildToKey) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">
              {addingChildToKey ? "Add Child Node" : "Edit HTML Node"}
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              {addingChildToKey
                ? "Create a new tag under the selected parent"
                : `Modifying node ${_editingKeyShort(editingNodeKey || "")}`}
            </p>

            <form onSubmit={addingChildToKey ? submitAddChild : submitEditNode} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                    HTML Tag
                  </label>
                  <input
                    type="text"
                    required
                    value={nodeForm.tag}
                    onChange={(e) => setNodeForm({ ...nodeForm, tag: e.target.value })}
                    placeholder="div, h1, p, button..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                    Text Content
                  </label>
                  <input
                    type="text"
                    value={nodeForm.text}
                    onChange={(e) => setNodeForm({ ...nodeForm, text: e.target.value })}
                    placeholder="Optional text"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  CSS Class (Tailwind / Custom)
                </label>
                <input
                  type="text"
                  value={nodeForm.class}
                  onChange={(e) => setNodeForm({ ...nodeForm, class: e.target.value })}
                  placeholder="flex items-center text-sm font-bold..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Inline Style
                </label>
                <input
                  type="text"
                  value={nodeForm.style}
                  onChange={(e) => setNodeForm({ ...nodeForm, style: e.target.value })}
                  placeholder="margin-top: 10px; color: #fff;"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingNodeKey(null);
                    setAddingChildToKey(null);
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

function _editingKeyShort(key: string): string {
  if (key.length <= 12) return key;
  return key.slice(0, 10) + "...";
}

/**
 * Рекурсивный компонент отображения узла в визуальном дереве
 */
function NodeRow({
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
    <div className={`space-y-2 ${depth > 0 ? "ml-4 sm:ml-6 pl-3 border-l border-zinc-800/80" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
            &lt;{node.tag}&gt;
          </span>

          {node.text && (
            <span className="text-xs text-zinc-300 truncate max-w-[200px]" title={node.text}>
              &quot;{node.text}&quot;
            </span>
          )}

          {node.class && (
            <span
              className="text-[11px] font-mono text-zinc-500 truncate max-w-[150px] hidden md:inline"
              title={node.class}
            >
              .{node.class.split(" ").slice(0, 3).join(".")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onAddChild(node._key || "")}
            title="Add child node"
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-semibold transition cursor-pointer"
          >
            + Child
          </button>
          <button
            onClick={() => onEdit(node)}
            title="Edit node"
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition cursor-pointer"
          >
            ✎ Edit
          </button>
          {!isRoot && (
            <button
              onClick={() => onDelete(node._key || "")}
              title="Delete node"
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-950/80 text-red-400 text-xs font-medium transition cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {hasChildren && (
        <div className="space-y-2">
          {(node.children as HtmlNode[]).map((child) => (
            <NodeRow
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
