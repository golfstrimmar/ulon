"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderIcon,
  FolderPlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  CloudArrowUpIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import ButtonClose from "@/components/ButtonClose";
import { useProjectManager } from "./useProjectManager";

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectManagerModal({
  isOpen,
  onClose,
}: ProjectManagerModalProps) {
  const {
    folders,
    activeFolder,
    activeFolderId,
    setActiveFolderId,
    isLoading,
    isSaving,
    actionError,
    createFolder,
    renameFolder,
    deleteFolder,
    saveCurrentCanvasAsProject,
    loadProjectToCanvas,
    renameProject,
    deleteProject,
  } = useProjectManager();

  // Локальные стейты для форм и инлайн-редактирования
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderEditVal, setFolderEditVal] = useState("");

  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectEditVal, setProjectEditVal] = useState("");

  // Создание новой папки сайта
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const ok = await createFolder(newFolderName);
    if (ok) {
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  // Переименование папки
  const handleSaveRenameFolder = async (id: string) => {
    if (!folderEditVal.trim()) return;
    await renameFolder(id, folderEditVal);
    setEditingFolderId(null);
  };

  // Сохранение снимка холста в выбранную папку
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !activeFolderId) return;
    const ok = await saveCurrentCanvasAsProject(newProjectName, activeFolderId);
    if (ok) {
      setNewProjectName("");
    }
  };

  // Переименование проекта
  const handleSaveRenameProject = async (id: string) => {
    if (!projectEditVal.trim()) return;
    await renameProject(id, projectEditVal);
    setEditingProjectId(null);
  };

  // Загрузка проекта на холст
  const handleLoadProject = async (id: string) => {
    const ok = await loadProjectToCanvas(id);
    if (ok) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
        >
          <div
            className="w-full max-w-5xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
            role="dialog"
            aria-modal="true"
          >
            {/* ─── Шапка ─── */}
            <div className="h-14 px-6 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <CloudArrowUpIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-100 tracking-wide">
                    Cloud Projects & Site Fragments
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Neon PostgreSQL storage connected to your user account
                  </p>
                </div>
              </div>
              <ButtonClose setClose={onClose} />
            </div>

            {actionError && (
              <div className="px-6 py-2 bg-red-950/40 border-b border-red-800/60 text-xs text-red-300">
                ⚠️ {actionError}
              </div>
            )}

            {/* ─── Двухколоночный интерфейс ─── */}
            <div className="flex-1 flex overflow-hidden">
              {/* ЛЕВАЯ КОЛОНКА: Папки сайтов */}
              <div className="w-72 border-r border-zinc-800 bg-zinc-950/80 flex flex-col shrink-0">
                <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-wider">
                    Websites / Folders ({folders.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(true)}
                    className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-blue-400 transition"
                    title="Create new site folder"
                  >
                    <FolderPlusIcon className="w-4 h-4" />
                  </button>
                </div>

                {isCreatingFolder && (
                  <form
                    onSubmit={handleCreateFolder}
                    className="p-3 border-b border-zinc-800 flex gap-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name (e.g. My Shop)"
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!newFolderName.trim()}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="px-2 py-1 text-zinc-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </form>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                  {folders.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-xs text-zinc-500">
                      <span>No folders yet.</span>
                      <span>
                        Click + above to create a folder for this website.
                      </span>
                    </div>
                  ) : (
                    folders.map((folder) => {
                      const isActive = folder.id === activeFolderId;
                      const isEditing = folder.id === editingFolderId;

                      return (
                        <div
                          key={folder.id}
                          onClick={() => setActiveFolderId(folder.id)}
                          className={`group p-2.5 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer select-none ${
                            isActive
                              ? "bg-blue-600/15 border-blue-500/80 text-white font-medium shadow-sm"
                              : "bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FolderIcon
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? "text-blue-400" : "text-zinc-500"
                              }`}
                            />
                            {isEditing ? (
                              <div
                                className="flex items-center gap-1 flex-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  autoFocus
                                  value={folderEditVal}
                                  onChange={(e) =>
                                    setFolderEditVal(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleSaveRenameFolder(folder.id);
                                    if (e.key === "Escape")
                                      setEditingFolderId(null);
                                  }}
                                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveRenameFolder(folder.id)
                                  }
                                  className="text-emerald-400 p-0.5"
                                >
                                  <CheckIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFolderId(null)}
                                  className="text-zinc-400 p-0.5"
                                >
                                  <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs truncate">
                                {folder.name}
                              </span>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFolderId(folder.id);
                                  setFolderEditVal(folder.name);
                                }}
                                title="Rename folder"
                                className="p-1 hover:text-blue-300 text-zinc-400"
                              >
                                <PencilSquareIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    confirm(
                                      `Delete folder «${folder.name}» and all its projects?`,
                                    )
                                  ) {
                                    deleteFolder(folder.id);
                                  }
                                }}
                                title="Delete folder"
                                className="p-1 hover:text-red-400 text-zinc-400"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {!isEditing && (
                            <span className="text-[10px] font-mono text-zinc-500 group-hover:hidden">
                              {folder.projects?.length || 0}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ПРАВАЯ КОЛОНКА: Проекты выбранного сайта */}
              <div className="flex-1 bg-zinc-950 flex flex-col overflow-hidden">
                {activeFolder ? (
                  <>
                    {/* Форма сохранения текущего состояния холста */}
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                          <CloudArrowUpIcon className="w-4 h-4 text-blue-400" />
                          Save Current Canvas into «{activeFolder.name}»
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          Captures HTML nodes, SCSS classes & Scripts
                        </span>
                      </div>

                      <form onSubmit={handleSaveProject} className="flex gap-2">
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="Fragment name (e.g. Header v1, Pricing Section, Hero Banner)"
                          className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <button
                          type="submit"
                          disabled={isSaving || !newProjectName.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-900/30 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isSaving ? "Saving..." : "Save to Cloud"}
                        </button>
                      </form>
                    </div>

                    {/* Список сохраненных фрагментов */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pb-1">
                        <span>SAVED FRAGMENTS IN THIS WEBSITE</span>
                        <span>{activeFolder.projects?.length || 0} items</span>
                      </div>

                      {activeFolder.projects?.length === 0 ? (
                        <div className="h-48 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-xs text-zinc-500 gap-1">
                          <DocumentDuplicateIcon className="w-8 h-8 text-zinc-700 mb-1" />
                          <span>No saved fragments in this folder yet.</span>
                          <span>
                            Type a name above and click "Save to Cloud".
                          </span>
                        </div>
                      ) : (
                        activeFolder.projects.map((proj) => {
                          const isEditing = proj.id === editingProjectId;

                          return (
                            <div
                              key={proj.id}
                              className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 flex items-center justify-between gap-3 transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <DocumentDuplicateIcon className="w-4 h-4 text-blue-400 shrink-0" />
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <input
                                      type="text"
                                      autoFocus
                                      value={projectEditVal}
                                      onChange={(e) =>
                                        setProjectEditVal(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          handleSaveRenameProject(proj.id);
                                        if (e.key === "Escape")
                                          setEditingProjectId(null);
                                      }}
                                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSaveRenameProject(proj.id)
                                      }
                                      className="text-emerald-400 p-1"
                                    >
                                      <CheckIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingProjectId(null)}
                                      className="text-zinc-400 p-1"
                                    >
                                      <XMarkIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-semibold text-zinc-200 truncate">
                                      {proj.name}
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-500">
                                      Updated:{" "}
                                      {new Date(
                                        proj.updatedAt,
                                      ).toLocaleDateString()}{" "}
                                      at{" "}
                                      {new Date(
                                        proj.updatedAt,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {!isEditing && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Извлечь на холст */}
                                  <button
                                    type="button"
                                    onClick={() => handleLoadProject(proj.id)}
                                    title="Load this fragment onto canvas"
                                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                                  >
                                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                    <span>Load</span>
                                  </button>

                                  {/* Переименовать */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingProjectId(proj.id);
                                      setProjectEditVal(proj.name);
                                    }}
                                    title="Rename fragment"
                                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
                                  >
                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Удалить */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Delete fragment «${proj.name}»?`,
                                        )
                                      ) {
                                        deleteProject(proj.id);
                                      }
                                    }}
                                    title="Delete fragment"
                                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition cursor-pointer"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 text-xs gap-2">
                    <FolderIcon className="w-12 h-12 text-zinc-800" />
                    <span>
                      Select or create a website folder on the left to view and
                      save fragments.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
