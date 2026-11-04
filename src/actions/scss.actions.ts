"use server";

import * as sass from "sass";

export interface CompileScssResult {
  success: boolean;
  css: string;
  error?: string;
}

/**
 * 🔹 Серверный экшен компиляции SCSS строки в чистый CSS
 */
export async function compileScssAction(
  scss: string,
): Promise<CompileScssResult> {
  try {
    const code = (scss || "").trim();
    if (!code) {
      return { success: true, css: "" };
    }

    const result = sass.compileString(code, {
      style: "expanded",
    });

    return { success: true, css: result.css };
  } catch (err: any) {
    const shortError = err.message ? err.message.split("\n")[0] : "SCSS error";
    return {
      success: false,
      css: "",
      error: shortError,
    };
  }
}
