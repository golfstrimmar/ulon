import { useCallback, useEffect } from "react";
import { LIVE_STYLE_ID } from "@/app/plaza/components/CanvasArea/constants/theme";

export function useLiveStyle() {
  const extractNumericProp = useCallback(
    (propName: string, scssText: string): number => {
      if (!scssText) return 0;
      const regex = new RegExp(
        `${propName}\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)px`,
        "i",
      );
      const match = scssText.match(regex);
      return match ? parseFloat(match[1]) : 0;
    },
    [],
  );

  // 🔹 Мгновенный инжект в DOM preview без базы
  const applyLiveStyle = useCallback(
    (selector: string, prop: string, rawValue: string | number) => {
      if (!selector) return;

      // Очищаем селектор от лишних точек и пробелов
      const cleanClass = selector.trim().replace(/^\./, "").split(/\s+/)[0];

      // Форматируем значение: не допускаем pxpx и не пишем px для opacity
      let valStr = String(rawValue).trim();
      if (typeof rawValue === "number") {
        valStr = prop === "opacity" ? String(rawValue) : `${rawValue}px`;
      } else {
        // Если передали строку без единиц для размера — добавляем px
        if (
          prop !== "opacity" &&
          !valStr.includes("px") &&
          !valStr.includes("%") &&
          !valStr.includes("vh") &&
          !valStr.includes("vw") &&
          !valStr.includes("auto")
        ) {
          valStr = `${valStr}px`;
        }
      }

      const cssRule = `.${cleanClass} { ${prop}: ${valStr} !important; }`;

      const inject = (doc: Document) => {
        if (!doc.head) return;
        let tag = doc.getElementById(LIVE_STYLE_ID) as HTMLStyleElement | null;
        if (!tag) {
          tag = doc.createElement("style");
          tag.id = LIVE_STYLE_ID;
          doc.head.appendChild(tag);
        }
        tag.textContent = cssRule;
      };

      // Инжектим в основной документ и ВО ВСЕ IFRAME на странице (0 ms задержки)
      inject(document);
      document.querySelectorAll("iframe").forEach((iframe) => {
        try {
          if (iframe.contentDocument) inject(iframe.contentDocument);
        } catch {}
      });
    },
    [],
  );

  const removeLiveStyle = useCallback(() => {
    document.getElementById(LIVE_STYLE_ID)?.remove();
    document.querySelectorAll("iframe").forEach((iframe) => {
      try {
        iframe.contentDocument?.getElementById(LIVE_STYLE_ID)?.remove();
      } catch {}
    });
  }, []);

  useEffect(() => () => removeLiveStyle(), [removeLiveStyle]);

  return { extractNumericProp, applyLiveStyle, removeLiveStyle };
}
