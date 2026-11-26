import { extractNestedSnippet } from "@/lib/scssCompiler";
import { getSegmentDisplay } from "@/app/plaza/components/CanvasArea/components/ModalCustomStyles/constants/breakpointLibrary";
import type {
  ScopeHeaderInfo,
} from "../types/modalActiveScopeStyles.types";

/**
 * Формирует структурированную информацию о текущем скоупе для шапки модалки
 */
export function getScopeHeaderInfo(
  currentClass: string,
  activeScope: string
): ScopeHeaderInfo {
  if (activeScope === "base") {
    return {
      type: "base",
      currentClass,
      scope: "base",
    };
  }

  if (activeScope.startsWith("@media")) {
    const seg = getSegmentDisplay(activeScope);
    return {
      type: "media",
      currentClass,
      scope: activeScope,
      mediaSegment: seg.segment,
      mediaName: seg.name,
    };
  }

  return {
    type: "pseudo",
    currentClass,
    scope: activeScope,
  };
}

/**
 * Оборачивает CSS/SCSS свойства в активный скоуп (псевдоэлемент или медиа-запрос)
 */
export function wrapSnippetWithScope({
  snippet,
  activeScope,
  currentScssText = "",
}: {
  snippet: string;
  activeScope: string;
  currentScssText?: string;
}): string {
  const trimmed = snippet.trim();
  if (!trimmed) return "";

  // Базовый класс или сниппет уже является селектором
  if (
    activeScope === "base" ||
    trimmed.startsWith("&") ||
    trimmed.startsWith("@media") ||
    trimmed.startsWith(".")
  ) {
    return trimmed;
  }

  let body = trimmed;
  // Для &:before и &:after добавляем content: "" если его ещё нет
  if (
    (activeScope === "&:before" || activeScope === "&:after") &&
    !currentScssText.includes(activeScope) &&
    !body.includes("content:")
  ) {
    body = `content: "";\n  ${body}`;
  }

  return `${activeScope} {\n  ${body.split("\n").join("\n  ")}\n}`;
}

/**
 * Извлекает SCSS правила для активного скоупа
 */
export function extractEffectiveScssText(
  currentScssText: string,
  activeScope: string
): string {
  if (!currentScssText || activeScope === "base") {
    return currentScssText;
  }
  return extractNestedSnippet(currentScssText, activeScope) || currentScssText;
}
