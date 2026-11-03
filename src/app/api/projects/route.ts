import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const saveProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  folderId: z.string().min(1, "Folder selection is required"),
  htmlJson: z.any(),
  scss: z.string().optional().default(""),
  js: z.string().optional().default(""),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const body = await req.json();
    const parsed = saveProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { name, folderId, htmlJson, scss, js } = parsed.data;

    // Проверяем, что папка действительно принадлежит этому пользователю
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Target folder not found" },
        { status: 404 },
      );
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        folderId,
        userId,
        htmlJson: htmlJson || [],
        scss: scss || "",
        js: js || "",
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to save project" },
      { status: 500 },
    );
  }
}
