"use client";

import { useMemo, useCallback } from "react";
import type { ModalActiveScopeStylesProps } from "../types/modalActiveScopeStyles.types";
import {
  getScopeHeaderInfo,
  wrapSnippetWithScope,
  extractEffectiveScssText,
} from "../models/modalActiveScopeStylesModel";

export function useModalActiveScopeStylesController({
  currentClass,
  activeScope = "base",
  currentScssText = "",
  onApplySnippet,
  onClose,
  onSelectScope,
}: Pick<
  ModalActiveScopeStylesProps,
  | "currentClass"
  | "activeScope"
  | "currentScssText"
  | "onApplySnippet"
  | "onClose"
  | "onSelectScope"
>) {
  const headerInfo = useMemo(
    () => getScopeHeaderInfo(currentClass, activeScope),
    [currentClass, activeScope]
  );

  const effectiveScssText = useMemo(
    () => extractEffectiveScssText(currentScssText, activeScope),
    [currentScssText, activeScope]
  );

  const handleScopedApplySnippet = useCallback(
    (snippet: string) => {
      const wrapped = wrapSnippetWithScope({
        snippet,
        activeScope,
        currentScssText,
      });
      if (wrapped) {
        onApplySnippet(wrapped);
      }
    },
    [activeScope, currentScssText, onApplySnippet]
  );

  const handleBackToBase = useCallback(() => {
    if (onSelectScope) {
      onSelectScope("base");
    }
  }, [onSelectScope]);

  return {
    headerInfo,
    effectiveScssText,
    handleScopedApplySnippet,
    handleBackToBase,
    handleClose: onClose,
  };
}
