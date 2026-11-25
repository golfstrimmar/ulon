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

Если говорить честно, без прикрас — рынок сильно разделился:
1. Что действительно почти ушло в ИИ и конструкторы
Дешёвые и типовые заказы — простые лендинги, однотипные промо-страницы, шаблонные MVP, внутренние админки — действительно массово забирают AI-генераторы и конструкторы. Конкурировать руками в сегменте «сделайте простенький сайт недорого» сейчас уже почти бессмысленно.
2. Где такие заказы всё ещё есть
Заказы уровня «дорогой кастомный макет из Figma» никуда не исчезли, просто они сместились в сегмент, где цена ошибки или кривой вёрстки высокая:
Проекты после сильных дизайн-студий: когда клиент заплатил за уникальный дизайн в Figma и требует 100% попадания в макет, нестандартную сетку, микроанимации и идеальный адаптив на всех экранах.
Вёрстка под интеграцию в живой бизнес (e-commerce, порталы, WordPress / Bitrix / Laravel / Next.js): там нельзя просто скопировать то, что нагенерировал AI-агент «с нуля» — нужен чистый, предсказуемый HTML/SCSS/JS с понятными классами и без мусорных обёрток, чтобы бэкенд-команда смогла это без боли натянуть.
Сложные интерфейсные секции (кастомные табы, конфигураторы, многоуровневые формы, нестандартные слайдеры), где ИИ по промпту начинает ломать соседние блоки при каждой мелкой правке.
3. В чём тут главный вывод для твоего проекта
Чисто руками верстать долго (падает маржа, заказчики ждут сроков быстрее из-за хайпа вокруг ИИ). А чисто ИИ — теряет точность и контроль.
Поэтому в выигрыше остаётся не тот, кто отказывается от ИИ, и не тот, кто слепо полагается на промпты, а профессионал со скоростным станком.

Тогда у тебя будет и скорость почти как у ИИ, и качество дорогой ручной вёрстки.
------------------
npx repomix --include "src/pages/**,package.json,src/App.tsx"
npx repomix --include "src/actions/**"
npx repomix --include "src/app/plaza/components/CanvasArea/components/AsideCanvas/**"
npx repomix --include "public/json/galleryes/**"
npx repomix --include "public/json/sections/**"
