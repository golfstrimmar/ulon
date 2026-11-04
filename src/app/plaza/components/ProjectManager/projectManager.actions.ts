"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { FolderItem, FullProjectPayload } from "./projectManager.types";

/**
 * 🔒 Вспомогательный метод: проверка авторизации текущего пользователя
 */
async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: Please sign in to manage projects");
  }
  return session.user.id;
}

// ─── 1. ПАПКИ (FOLDERS) ───

export async function getFoldersAction(): Promise<{
  success: boolean;
  folders?: FolderItem[];
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();

    const rawFolders = await prisma.folder.findMany({
      where: { userId },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const folders: FolderItem[] = rawFolders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      projects: f.projects.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    }));

    return { success: true, folders };
  } catch (err: any) {
    console.error("getFoldersAction error:", err);
    return { success: false, error: err.message || "Failed to load folders" };
  }
}

export async function createFolderAction(name: string): Promise<{
  success: boolean;
  folder?: any;
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();
    const folderName = name.trim();
    if (!folderName) throw new Error("Folder name is required");

    const existing = await prisma.folder.findFirst({
      where: { userId, name: folderName },
    });
    if (existing) {
      throw new Error("Folder with this name already exists");
    }

    const folder = await prisma.folder.create({
      data: { name: folderName, userId },
      include: { projects: true },
    });

    return { success: true, folder };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function renameFolderAction(
  id: string,
  newName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const name = newName.trim();
    if (!name) throw new Error("Folder name is required");

    await prisma.folder.updateMany({
      where: { id, userId },
      data: { name },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteFolderAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    await prisma.folder.deleteMany({
      where: { id, userId },
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── 2. ПРОЕКТЫ И ФРАГМЕНТЫ (PROJECTS) ───

export async function saveProjectAction(data: {
  name: string;
  folderId: string;
  htmlJson: any;
  scss?: string;
  js?: string;
}): Promise<{ success: boolean; project?: any; error?: string }> {
  try {
    const userId = await getAuthUserId();
    const { name, folderId, htmlJson, scss, js } = data;

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Project name is required");
    if (!folderId) throw new Error("Target folder is required");

    // Проверяем принадлежность папки
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) throw new Error("Target folder not found");

    const project = await prisma.project.create({
      data: {
        name: trimmedName,
        folderId,
        userId,
        htmlJson: htmlJson || [],
        scss: scss || "",
        js: js || "",
      },
    });

    return { success: true, project };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function loadProjectAction(id: string): Promise<{
  success: boolean;
  project?: FullProjectPayload;
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();
    const rawProject = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!rawProject) throw new Error("Project not found");

    const project: FullProjectPayload = {
      id: rawProject.id,
      name: rawProject.name,
      folderId: rawProject.folderId,
      htmlJson: (rawProject.htmlJson as any) || [],
      scss: rawProject.scss || "",
      js: rawProject.js || "",
      updatedAt: rawProject.updatedAt.toISOString(),
    };

    return { success: true, project };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProjectAction(
  id: string,
  data: {
    name?: string;
    htmlJson?: any;
    scss?: string;
    js?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();

    const updateData: any = {
      updatedAt: new Date(),
    };
    if (data.name?.trim()) updateData.name = data.name.trim();
    if (data.htmlJson !== undefined) updateData.htmlJson = data.htmlJson;
    if (data.scss !== undefined) updateData.scss = data.scss;
    if (data.js !== undefined) updateData.js = data.js;

    await prisma.project.updateMany({
      where: { id, userId },
      data: updateData,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProjectAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getAuthUserId();
    await prisma.project.deleteMany({
      where: { id, userId },
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
