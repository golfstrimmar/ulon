"use client";

import { useState } from "react";
import {
  parseFigmaColors,
  generateScss,
  type ColorToken,
} from "@/app/design/utils/figmaColorParser";
import { saveColorVariables } from "@/lib/figmaColorStorage";

export function FigmaColorsViewer() {
  const [rawJson, setRawJson] = useState("");
  const [tokens, setTokens] = useState<ColorToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const handleJsonChange = (value: string) => {
    setRawJson(value);
    const result = parseFigmaColors(value);
    setTokens(result.tokens);
    setError(result.error);
  };

  // Копирование имени отдельной переменной
  const handleCopySingle = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(id);
    setTimeout(() => setCopiedVar(null), 1800);
  };

  // Сохранение массива строк переменных в базу
  const handleSaveToDb = async () => {
    if (tokens.length === 0) return;

    // Превращаем токены в массив строк: ["$color-1: #162D5F;", ...]
    const stringArray = tokens.map((t) => `${t.varName}: ${t.hex};`);

    try {
      await saveColorVariables(stringArray);
      window.dispatchEvent(
        new CustomEvent("figma_colors:saved", { detail: stringArray }),
      );
      setCopiedVar("all-scss");
      setTimeout(() => setCopiedVar(null), 1800);
    } catch (error) {
      console.error("Error", error);
    } finally {
      console.log("<🛑🛑🛑=ok=🛑🛑🛑>");
    }
  };

  const scssOutput = generateScss(tokens);

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Textarea Input */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="figma-json"
            className="text-sm font-semibold text-zinc-200"
          >
            Figma Plugin JSON
          </label>
          {rawJson && (
            <button
              onClick={() => handleJsonChange("")}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              Clear
            </button>
          )}
        </div>

        <textarea
          id="figma-json"
          rows={6}
          value={rawJson}
          onChange={(e) => handleJsonChange(e.target.value)}
          placeholder="Paste your Figma JSON here..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-600 resize-y"
        />

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
            ⚠️ {error}
          </p>
        )}
      </section>

      {/* Color Cards */}
      {tokens.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            Extracted Colors ({tokens.length})
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {tokens.map((token) => (
              <div
                key={token.varName}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col gap-3 shadow-sm"
              >
                <div
                  className="w-full h-20 rounded-lg relative overflow-hidden border border-white/5"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #1f1f23 25%, transparent 25%), linear-gradient(-45deg, #1f1f23 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f1f23 75%), linear-gradient(-45deg, transparent 75%, #1f1f23 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                  }}
                >
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: token.original }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopySingle(token.varName, token.varName)
                    }
                    className="flex items-center justify-between text-left group"
                  >
                    <span className="font-mono text-sm font-semibold text-blue-400 group-hover:underline">
                      {token.varName}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {copiedVar === token.varName ? "Copied!" : "Copy"}
                    </span>
                  </button>
                  <div className="font-mono text-xs text-zinc-300">
                    {token.hex}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-500 truncate">
                    {token.original}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SCSS Block */}
      {tokens.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">
              Generated SCSS
            </h2>
            <button
              onClick={handleSaveToDb}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-700 transition"
            >
              {copiedVar === "all-scss" ? "Saved!" : "Save to DB"}
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
            <pre className="font-mono text-xs text-zinc-300 leading-relaxed">
              <code>{scssOutput}</code>
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
