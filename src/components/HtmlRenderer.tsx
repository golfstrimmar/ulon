"use client";

import React, { useMemo } from "react";
import { HtmlNode } from "@/types/htmlJson";

/**
 * Преобразует CSS-строку стиля (например, "color: red; margin-top: 10px") в объект React.CSSProperties
 */
function parseStyleString(styleStr: string): React.CSSProperties {
  if (!styleStr || typeof styleStr !== "string") return {};
  const styleObj: Record<string, string> = {};

  styleStr.split(";").forEach((rule) => {
    const [prop, val] = rule.split(":");
    if (prop && val) {
      // Преобразуем kebab-case (margin-top) в camelCase (marginTop)
      const camelProp = prop.trim().replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      styleObj[camelProp] = val.trim();
    }
  });

  return styleObj as React.CSSProperties;
}

/**
 * Рекурсивный рендеринг узла HtmlNode в нативные элементы React DOM
 */
export function HtmlRenderer({ node }: { node: HtmlNode }) {
  if (!node || !node.tag) return null;

  const Tag = (node.tag.toLowerCase() || "div") as keyof React.JSX.IntrinsicElements;
  const style = useMemo(() => parseStyleString(node.style), [node.style]);

  // Сборка props для DOM-элемента
  const props: Record<string, any> = {
    key: node._key,
    className: node.class || undefined,
    style: Object.keys(style).length > 0 ? style : undefined,
    ...(node.attributes || {}),
  };

  // 1. Если children — строка текста
  if (typeof node.children === "string") {
    return React.createElement(Tag, props, node.children);
  }

  // 2. Если children — массив узлов HtmlNode
  if (Array.isArray(node.children) && node.children.length > 0) {
    const renderedChildren = node.children.map((childNode) => (
      <HtmlRenderer key={childNode._key} node={childNode} />
    ));

    // Если у текущего узла есть еще и собственный text
    if (node.text) {
      return React.createElement(Tag, props, node.text, ...renderedChildren);
    }

    return React.createElement(Tag, props, ...renderedChildren);
  }

  // 3. Если детей нет, но есть text
  if (node.text) {
    return React.createElement(Tag, props, node.text);
  }

  // 4. Пустой тег
  return React.createElement(Tag, props);
}
