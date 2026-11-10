import type { ProductionBundle } from "../models/types";

/**
 * Скачивает текстовый файл в браузере через Blob и временную ссылку
 */
export function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Упаковывает сгенерированные файлы бандла в zip-архив и запускает скачивание
 */
export async function downloadZip(bundle: ProductionBundle): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  zip.file("index.html", bundle.html);
  zip.file("styles.css", bundle.css);
  if (bundle.js.trim()) {
    zip.file("scripts.js", bundle.js);
  }

  // Добавляем папку assets с изображениями
  if (bundle.assets && bundle.assets.length > 0) {
    const assetsFolder = zip.folder("assets");
    if (assetsFolder) {
      for (const asset of bundle.assets) {
        assetsFolder.file(asset.name, asset.blob);
      }
    }
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: "production-build.zip",
  });
  a.click();
  URL.revokeObjectURL(url);
}
