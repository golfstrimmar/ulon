import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const folderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(60),
});

// Получить все папки текущего пользователя со списком проектов
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const folders = await prisma.folder.findMany({
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

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("GET /api/folders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 },
    );
  }
}

// Создать новую папку сайта
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const body = await req.json();
    const parsed = folderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const folderName = parsed.data.name.trim();

    const existing = await prisma.folder.findFirst({
      where: { userId, name: folderName },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Folder with this name already exists" },
        { status: 409 },
      );
    }

    const folder = await prisma.folder.create({
      data: {
        name: folderName,
        userId,
      },
      include: { projects: true },
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("POST /api/folders error:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 },
    );
  }
}

// Переименовать папку
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const body = await req.json();
    const { id, name } = body;
    if (!id || !name?.trim()) {
      return NextResponse.json(
        { error: "Folder ID and new name are required" },
        { status: 400 },
      );
    }

    const updated = await prisma.folder.updateMany({
      where: { id, userId },
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true, count: updated.count });
  } catch (error) {
    console.error("PATCH /api/folders error:", error);
    return NextResponse.json(
      { error: "Failed to rename folder" },
      { status: 500 },
    );
  }
}

// Удалить папку сайта со всеми ее фрагментами
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id)
      return NextResponse.json(
        { error: "Folder ID required" },
        { status: 400 },
      );

    await prisma.folder.deleteMany({
      where: { id, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/folders error:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 },
    );
  }
}
