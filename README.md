This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
<!--===============================================-->
import { motion, AnimatePresence } from "framer-motion";
<AnimatePresence></AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, y: 0 }}
                          animate={{ height: "auto", opacity: 1, y: 0 }}
                          exit={{ height: 0, opacity: 0, y: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          // className="absolute top-full bg-white border border-gray-200 rounded-b-md shadow-md z-10 w-fit min-w-[150px] max-w-full"

                          className="pl-3 py-0.5 space-y-1 border-l border-zinc-800/80"
                        >
                       </motion.div>
                      )}
</AnimatePresence>
<!--===============================================-->
window.dispatchEvent(
  new CustomEvent("plaza-tree-updated", { detail: next }),
);
window.dispatchEvent(
  new CustomEvent("plaza-styles-updated", { detail: nextScss }),
);
window.addEventListener("plaza-styles-updated", handleExternalStyles);
return () =>
  window.removeEventListener("plaza-styles-updated", handleExternalStyles);
  
  
---просто вызвали с хука функцию ---
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
const { openModalFonts } = usePreviewArea();
onClick={() => openModalFonts()}

---на хуке просто уходит в шину и все. ---   
const [isFontsPanelOpen, setIsFontsPanelOpen] = useState<boolean>(false);
const openModalFonts = () => {
    setIsFontsPanelOpen((prev) => {
      const next = !prev;
      window.dispatchEvent(
        new CustomEvent("preview-fontspanel", {
          detail: next,
        }),
      );
      return next;
    });
  };

return { openModalFonts };
}
---на приемнике событие з шины поменяет состояние --- 
const [isFontsPanelOpen, setIsFontsPanelOpen] = useState<boolean>(false);
 useEffect(() => {
    const handleFontsPanel = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setIsFontsPanelOpen(customEvent.detail);
    };

    window.addEventListener("preview-fontspanel", handleFontsPanel);

    return () => {
      window.removeEventListener("preview-fontspanel", handleFontsPanel);
    };
  }, []);

<!---------------------------------------->
plaza-tree-updated
plaza-styles-updated 
plaza-scripts-updated
plaza-fonts-updated
preview-fontspanel
plaza-style-history-changed
<!--==============hook======// Сохранение SCSS в IndexedDB=======// Сохранение JS в IndexedDB====================-->
  import { saveGlobalScss, saveGlobalJs } from "@/lib/htmlStorage";
  const updateAndPersistScss = async (nextScss: string) => {
    try {
      await saveGlobalScss(nextScss);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: nextScss }),
      );
    } catch (e) {
      console.error("[CanvasArea] Error saving SCSS to DB:", e);
    }
  };

  const updateAndPersistJs = async (nextJs: string) => {
    try {
      await saveGlobalJs(nextJs);
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: nextJs }),
      );
    } catch (e) {
      console.error("[CanvasArea] Error saving JS to DB:", e);
    }
  };
<!--========================блокирует прокрутку боди на модалкаах=======================-->
useEffect(() => {
    if (openModalJson) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [openModalJson]);
<!--========================образец модалки и кнопки к нейц=======================-->
D:\WEB\ulon\src\app\plaza\components\PreviewArea\components\ButtonJson.tsx
D:\WEB\ulon\src\app\plaza\components\PreviewArea\components\ModalJsonHtml.tsx



------------------

// Helper function to extract CSS variable names and values
function parseCssVariables(css: string) {
  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  const tokens: { name: string; value: string }[] = [];
  let match;
  while ((match = regex.exec(css)) !== null) {
    tokens.push({ name: match[1], value: match[2].trim() });
  }
  return tokens;
}
 const rawUrl =
    "https://raw.githubusercontent.com/golfstrimmar/ulon-design-tokens/main/colors.css";

  let cssContent = "";
  try {
    const res = await fetch(rawUrl, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) {
      throw new Error(`Fetch error: ${res.statusText}`);
    }

    cssContent = await res.text();
  } catch (error) {
    return (
      <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 rounded-xl">
        Failed to load tokens: {(error as Error).message}
      </div>
    );
  }

  const tokens = parseCssVariables(cssContent);
 {/* Color Swatches Grid */}
      {/*<section>
        <h2 className="text-xl font-semibold mb-4 text-zinc-200">
          Color Palette ({tokens.length} tokens)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tokens.map((token) => (
            <div
              key={token.name}
              className="bg-zinc-900 border border-zinc-800/80 rounded-lg p-2.5 flex flex-col gap-2 shadow-sm"
            >
              <div
                className="w-full h-16 rounded border border-white/10 shadow-inner"
                style={{ backgroundColor: token.value }}
              />
              <div className="flex flex-col">
                <span
                  className="font-mono text-xs text-zinc-300 truncate"
                  title={token.name}
                >
                  {token.name}
                </span>
                <span className="font-mono text-[11px] text-zinc-500 uppercase">
                  {token.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>*/}

      {/* Raw CSS Code */}
      {/*<section>
        <h2 className="text-xl font-semibold mb-4 text-zinc-200">Source CSS</h2>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
          <pre className="font-mono text-xs text-zinc-300 leading-relaxed">
            <code>{cssContent}</code>
          </pre>
        </div>
      </section>*/}
