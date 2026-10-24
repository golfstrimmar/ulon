import { NextResponse } from "next/server";
import * as sass from "sass";

export async function POST(req: Request) {
  try {
    const { scss } = await req.json();
    if (!scss || !scss.trim()) {
      return NextResponse.json({ css: "" });
    }

    const result = sass.compileString(scss, {
      style: "expanded",
    });

    return NextResponse.json({ css: result.css });
  } catch (err: any) {
    // В случае опечатки в SCSS возвращаем понятную ошибку и исходный текст
    return NextResponse.json(
      { css: "", error: err.message || "SCSS compilation error" },
      { status: 400 },
    );
  }
}
