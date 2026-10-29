"use client";

import { useState, useEffect } from "react";
import {
  parseFigmaColors,
  generateScss,
  type ColorToken,
} from "@/app/design/utils/figmaColorParser";
import { saveColorVariables } from "@/lib/figmaColorStorage";

interface FigmaColorsViewerProps {
  rawJson: string;
}

export function FigmaColorsViewer({ rawJson }: FigmaColorsViewerProps) {
  const [tokens, setTokens] = useState<ColorToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  useEffect(() => {
    if (!rawJson.trim()) {
      setTokens([]);
      setError(null);
      return;
    }
    const result = parseFigmaColors(rawJson);
    setTokens(result.tokens);
    setError(result.error);
  }, [rawJson]);

  const handleCopySingle = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(id);
    setTimeout(() => setCopiedVar(null), 1800);
  };

  const handleSaveToDb = async () => {
    if (tokens.length === 0) return;

    const stringArray = tokens.map((t) => `${t.varName}: ${t.hex};`);

    try {
      await saveColorVariables(stringArray);
      window.dispatchEvent(
        new CustomEvent("figma_colors:saved", { detail: stringArray }),
      );
      setCopiedVar("all-scss");
      setTimeout(() => setCopiedVar(null), 1800);
    } catch (err) {
      console.error("Error", err);
    }
  };

  const scssOutput = generateScss(tokens);

  return (
    <div className="flex flex-col gap-6 w-full">
      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
          ⚠️ Ошибка цветов: {error}
        </p>
      )}

      {tokens.length > 0 && (
        <>
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

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                Generated SCSS
              </h2>
              <button
                type="button"
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
        </>
      )}
    </div>
  );
}
