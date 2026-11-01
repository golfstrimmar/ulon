export interface PseudoItem {
  selector: string;
  label: string;
  category: "elements" | "states" | "tree" | "forms";
  defaultSnippet: string;
}

export const PSEUDO_LIBRARY: PseudoItem[] = [
  // ─── 1. ПСЕВДОЭЛЕМЕНТЫ ────────────────────────────────────────────────────────
  {
    selector: "&:before",
    label: "&:before (центр слева)",
    category: "elements",
    defaultSnippet: `&:before {\n  content: "";\n  position: absolute;\n  top: 50%;\n  left: 0;\n  transform: translate(0, -50%);\n}`,
  },
  {
    selector: "&:after",
    label: "&:after (центр справа)",
    category: "elements",
    defaultSnippet: `&:after {\n  content: "";\n  position: absolute;\n  top: 50%;\n  right: 0;\n  transform: translate(0, -50%);\n}`,
  },
  {
    selector: "&::placeholder",
    label: "&::placeholder (текст-подсказка)",
    category: "elements",
    defaultSnippet: `&::placeholder {\n  color: #71717a;\n  opacity: 1;\n}`,
  },
  {
    selector: "&::selection",
    label: "&::selection (выделение текста)",
    category: "elements",
    defaultSnippet: `&::selection {\n  background-color: #6366f1;\n  color: #ffffff;\n}`,
  },
  {
    selector: "&::marker",
    label: "&::marker (маркер списка li)",
    category: "elements",
    defaultSnippet: `&::marker {\n  color: #6366f1;\n}`,
  },
  {
    selector: "&::first-letter",
    label: "&::first-letter (буквица)",
    category: "elements",
    defaultSnippet: `&::first-letter {\n  font-size: 1.5em;\n  font-weight: bold;\n}`,
  },
  {
    selector: "&::first-line",
    label: "&::first-line (первая строка)",
    category: "elements",
    defaultSnippet: `&::first-line {\n  font-weight: 600;\n}`,
  },
  {
    selector: "&::backdrop",
    label: "&::backdrop (фон диалога/модалки)",
    category: "elements",
    defaultSnippet: `&::backdrop {\n  background-color: rgba(0, 0, 0, 0.7);\n  backdrop-filter: blur(4px);\n}`,
  },
  {
    selector: "&::-webkit-scrollbar",
    label: "&::-webkit-scrollbar (скроллбар)",
    category: "elements",
    defaultSnippet: `&::-webkit-scrollbar {\n  width: 6px;\n  height: 6px;\n}`,
  },
  {
    selector: "&::-webkit-scrollbar-thumb",
    label: "&::-webkit-scrollbar-thumb (ползунок скролла)",
    category: "elements",
    defaultSnippet: `&::-webkit-scrollbar-thumb {\n  background-color: #3f3f46;\n  border-radius: 4px;\n}`,
  },

  // ─── 2. ИНТЕРАКТИВНЫЕ СОСТОЯНИЯ (STATES) ────────────────────────────────────
  {
    selector: "&:hover",
    label: "&:hover (при наведении)",
    category: "states",
    defaultSnippet: `&:hover {\n  \n}`,
  },
  {
    selector: "&:active",
    label: "&:active (при нажатии/клике)",
    category: "states",
    defaultSnippet: `&:active {\n  transform: scale(0.98);\n}`,
  },
  {
    selector: "&:focus",
    label: "&:focus (в фокусе)",
    category: "states",
    defaultSnippet: `&:focus {\n  outline: 2px solid #6366f1;\n  outline-offset: 2px;\n}`,
  },
  {
    selector: "&:focus-visible",
    label: "&:focus-visible (фокус с клавиатуры)",
    category: "states",
    defaultSnippet: `&:focus-visible {\n  outline: 2px solid #6366f1;\n}`,
  },
  {
    selector: "&:focus-within",
    label: "&:focus-within (фокус внутри контейнера)",
    category: "states",
    defaultSnippet: `&:focus-within {\n  border-color: #6366f1;\n}`,
  },
  {
    selector: "&:visited",
    label: "&:visited (посещенная ссылка)",
    category: "states",
    defaultSnippet: `&:visited {\n  color: #a855f7;\n}`,
  },
  {
    selector: "&:target",
    label: "&:target (цель якорной ссылки)",
    category: "states",
    defaultSnippet: `&:target {\n  animation: highlight 1s ease;\n}`,
  },

  // ─── 3. СТРУКТУРНЫЕ ПСЕВДОКЛАССЫ (TREE) ────────────────────────────────────
  {
    selector: "&:first-child",
    label: "&:first-child (первый ребенок)",
    category: "tree",
    defaultSnippet: `&:first-child {\n  margin-top: 0;\n}`,
  },
  {
    selector: "&:last-child",
    label: "&:last-child (последний ребенок)",
    category: "tree",
    defaultSnippet: `&:last-child {\n  margin-bottom: 0;\n}`,
  },
  {
    selector: "&:only-child",
    label: "&:only-child (единственный ребенок)",
    category: "tree",
    defaultSnippet: `&:only-child {\n  margin: 0;\n}`,
  },
  {
    selector: "&:nth-child(2)",
    label: "&:nth-child(2) (второй ребенок)",
    category: "tree",
    defaultSnippet: `&:nth-child(2) {\n  \n}`,
  },
  {
    selector: "&:nth-child(odd)",
    label: "&:nth-child(odd) (нечетные 1, 3, 5...)",
    category: "tree",
    defaultSnippet: `&:nth-child(odd) {\n  background-color: rgba(255, 255, 255, 0.02);\n}`,
  },
  {
    selector: "&:nth-child(even)",
    label: "&:nth-child(even) (четные 2, 4, 6...)",
    category: "tree",
    defaultSnippet: `&:nth-child(even) {\n  background-color: rgba(255, 255, 255, 0.05);\n}`,
  },
  {
    selector: "&:first-of-type",
    label: "&:first-of-type (первый своего типа)",
    category: "tree",
    defaultSnippet: `&:first-of-type {\n  \n}`,
  },
  {
    selector: "&:last-of-type",
    label: "&:last-of-type (последний своего типа)",
    category: "tree",
    defaultSnippet: `&:last-of-type {\n  \n}`,
  },
  {
    selector: "&:nth-of-type(odd)",
    label: "&:nth-of-type(odd) (нечетный своего типа)",
    category: "tree",
    defaultSnippet: `&:nth-of-type(odd) {\n  \n}`,
  },
  {
    selector: "&:nth-of-type(even)",
    label: "&:nth-of-type(even) (четный своего типа)",
    category: "tree",
    defaultSnippet: `&:nth-of-type(even) {\n  \n}`,
  },
  {
    selector: "&:empty",
    label: "&:empty (пустой без контента)",
    category: "tree",
    defaultSnippet: `&:empty {\n  display: none;\n}`,
  },
  {
    selector: "&:not(:last-child)",
    label: "&:not(:last-child) (все кроме последнего)",
    category: "tree",
    defaultSnippet: `&:not(:last-child) {\n  margin-bottom: 8px;\n}`,
  },
  {
    selector: "&:not(:first-child)",
    label: "&:not(:first-child) (все кроме первого)",
    category: "tree",
    defaultSnippet: `&:not(:first-child) {\n  margin-top: 8px;\n}`,
  },

  // ─── 4. ФОРМЫ И УСЛОВИЯ (FORMS) ─────────────────────────────────────────────
  {
    selector: "&:disabled",
    label: "&:disabled (отключенный элемент)",
    category: "forms",
    defaultSnippet: `&:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}`,
  },
  {
    selector: "&:enabled",
    label: "&:enabled (активный элемент)",
    category: "forms",
    defaultSnippet: `&:enabled {\n  cursor: pointer;\n}`,
  },
  {
    selector: "&:checked",
    label: "&:checked (отмеченный чекбокс/радио)",
    category: "forms",
    defaultSnippet: `&:checked {\n  border-color: #6366f1;\n}`,
  },
  {
    selector: "&:required",
    label: "&:required (обязательное поле)",
    category: "forms",
    defaultSnippet: `&:required {\n  \n}`,
  },
  {
    selector: "&:valid",
    label: "&:valid (валидное поле)",
    category: "forms",
    defaultSnippet: `&:valid {\n  border-color: #10b981;\n}`,
  },
  {
    selector: "&:invalid",
    label: "&:invalid (невалидное с ошибкой)",
    category: "forms",
    defaultSnippet: `&:invalid {\n  border-color: #ef4444;\n}`,
  },
  {
    selector: "&:read-only",
    label: "&:read-only (только для чтения)",
    category: "forms",
    defaultSnippet: `&:read-only {\n  background-color: #18181b;\n}`,
  },
  {
    selector: "&:placeholder-shown",
    label: "&:placeholder-shown (виден плейсхолдер)",
    category: "forms",
    defaultSnippet: `&:placeholder-shown {\n  border-color: #27272a;\n}`,
  },
];

export const CATEGORY_LABELS: Record<PseudoItem["category"], string> = {
  elements: "Псевдоэлементы (::before, ::after...)",
  states: "Состояния (:hover, :active, :focus...)",
  tree: "Структура (:first-child, :last-child, :nth-child...)",
  forms: "Формы (:disabled, :checked, :invalid...)",
};

/**
 * Извлекает все псевдоселекторы, присутствующие в SCSS коде класса
 */
export function extractExistingPseudoSelectors(scssText: string): string[] {
  if (!scssText) return [];
  const found = new Set<string>();
  const regex = /(?:^|\n)\s*(&[:a-zA-Z0-9_()-]+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(scssText)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}
