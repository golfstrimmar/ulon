/**
 * @file htmlJson.ts
 * @description Контракт данных для представления HTML-дерева в виде JSON (htmlJson).
 */

/**
 * Узел HTML-дерева (представление HTML-тега со свойствами и потомками)
 */
export type HtmlNode = {
  /** Имя HTML-тега (например: "div", "span", "h1", "button", "section" и т.д.) */
  tag: string;

  /** Текстовое содержимое узла (если есть) */
  text?: string;

  /** CSS-классы тега (например Tailwind-классы или кастомные имена классов) */
  class: string;

  /** Инлайн-стили тега (например: "color: red; display: flex;") */
  style: string;

  /** Произвольные HTML-атрибуты (например: { href: "/home", id: "hero", type: "button" }) */
  attributes?: Record<string, string>;

  /** Уникальный внутренний ключ узла для точечного поиска, редактирования и удаления в дереве */
  _key?: string;

  /** Служебный флаг: был ли узел только что создан (для анимации/фокуса) */
  _isNew?: boolean;

  /** Дочерние элементы: массив других узлов HtmlNode или строка текста */
  children: HtmlNode[] | string;
};

/**
 * Документ, сохраняемый в IndexedDB
 */
export type HtmlDocument = {
  /** Уникальный идентификатор документа (UUID) */
  id: string;

  /** Название документа (например: "Главный лендинг", "Шапка сайта") */
  title: string;

  /** Корневой узел HTML-дерева */
  root: HtmlNode;

  /** Временная метка создания (unix timestamp в ms) */
  createdAt: number;

  /** Временная метка последнего обновления (unix timestamp в ms) */
  updatedAt: number;
};
