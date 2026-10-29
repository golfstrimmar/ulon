"use client";

interface FigmaJsonInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  error?: string | null;
}

export function FigmaJsonInput({
  value,
  onChange,
  onClear,
  error,
}: FigmaJsonInputProps) {
  return (
    <section className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <label
          htmlFor="figma-json-input"
          className="text-sm font-semibold text-zinc-200"
        >
          Figma Plugin JSON
        </label>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Clear
          </button>
        )}
      </div>

      <textarea
        id="figma-json-input"
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Вставьте JSON из Figma плагина..."
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-600 resize-y"
      />

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
          ⚠️ {error}
        </p>
      )}
    </section>
  );
}
