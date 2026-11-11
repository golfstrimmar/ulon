import type { ProductionBundle } from "../models/types";
import type { GeneratedComponent } from "@/actions/reactGenerator.actions";
import {
  buildPackageJson,
  buildViteConfig,
  buildTsConfig,
  buildTailwindConfig,
  buildPostcssConfig,
  buildIndexHtml,
  buildMainTsx,
  buildIndexCss,
  buildReadme,
} from "./reactTemplate";

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


/**
 * Собирает React Vite проект в zip-архив и запускает скачивание.
 * Берёт сгенерированные ИИ компоненты + шаблон Vite + ассеты из бандла.
 */
export async function downloadReactZip({
  appCode,
  components,
  bundle,
}: {
  appCode: string;
  components: GeneratedComponent[];
  bundle: ProductionBundle;
}): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // 1. Корневые конфиги Vite-проекта
  zip.file("package.json", buildPackageJson());
  zip.file("vite.config.ts", buildViteConfig());
  zip.file("tsconfig.json", buildTsConfig());
  zip.file("tailwind.config.js", buildTailwindConfig());
  zip.file("postcss.config.js", buildPostcssConfig());
  zip.file("README.md", buildReadme());

  // 2. index.html c SVG-спрайтом (если есть)
  zip.file("index.html", buildIndexHtml(bundle.spriteContainer || ""));

  // 3. src/main.tsx — точка входа React
  const srcFolder = zip.folder("src")!;
  srcFolder.file("main.tsx", buildMainTsx());

  // 4. src/index.css — Tailwind директивы + пользовательский CSS
  srcFolder.file("index.css", buildIndexCss(bundle.css || ""));

  // 5. src/App.tsx — корневой компонент (от ИИ)
  srcFolder.file("App.tsx", appCode);

  // 6. src/components/*.tsx — дочерние компоненты (от ИИ)
  if (components.length > 0) {
    const componentsFolder = srcFolder.folder("components")!;
    for (const comp of components) {
      const fileName = comp.path
        .replace(/^src\/components\//, "")
        .replace(/^\//, "");
      componentsFolder.file(fileName, comp.code);
    }
  }

  // 7. src/assets/ — картинки и спрайт из бандла
  if (bundle.assets && bundle.assets.length > 0) {
    const assetsFolder = srcFolder.folder("assets")!;
    for (const asset of bundle.assets) {
      assetsFolder.file(asset.name, asset.blob);
    }
  }

  // Генерация и скачивание архива
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: "react-project.zip",
  });
  a.click();
  URL.revokeObjectURL(url);
}
