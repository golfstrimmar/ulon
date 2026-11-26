export type ScopeHeaderType = "base" | "media" | "pseudo";

export interface ScopeHeaderInfo {
  type: ScopeHeaderType;
  currentClass: string;
  scope: string;
  mediaSegment?: string;
  mediaName?: string;
}

export interface ModalActiveScopeStylesProps {
  isOpen: boolean;
  onClose: () => void;
  currentClass: string;
  activeScope?: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
  onSelectScope?: (scope: string) => void;
}
