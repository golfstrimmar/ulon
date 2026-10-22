/**
 * @file htmlJson.ts
 * @description Контракт данных для представления HTML-дерева в виде JSON (htmlJson).
 */

export type HtmlNode = {
  tag: string;
  text?: string;
  class: string;
  style: string;
  attributes?: Record<string, string>;
  _key?: string;
  _isNew?: boolean;
  children: HtmlNode[] | string;
};
