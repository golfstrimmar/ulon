/**
 * @file cssDeduper.ts
 * @description Дедупликация CSS: убирает повторяющиеся селекторы и свойства,
 * корректно обрабатывая вложенные @media блоки.
 */

/** Парсит тело правила "color: red; font-size: 14px;" в Map */
function parseDeclarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = body.split(";");
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    if (prop && val) {
      map.set(prop, val); // позднее значение перезаписывает раннее
    }
  }
  return map;
}

/** Сериализует Map деклараций обратно в валидный CSS */
function serializeDeclarations(decls: Map<string, string>): string {
  return Array.from(decls.entries())
    .map(([prop, val]) => `  ${prop}: ${val};`)
    .join("\n");
}

/** Разбивает CSS на блоки верхнего уровня с учётом вложенных фигурных скобок */
function parseTopBlocks(css: string): Array<{ selector: string; body: string }> {
  const blocks: Array<{ selector: string; body: string }> = [];
  let pos = 0;
  const len = css.length;

  while (pos < len) {
    while (pos < len && /\s/.test(css[pos])) pos++;
    if (pos >= len) break;

    const selectorStart = pos;
    const bracePos = css.indexOf("{", pos);
    if (bracePos === -1) break;

    const selector = css.slice(selectorStart, bracePos).trim();
    pos = bracePos + 1;

    let depth = 1;
    const bodyStart = pos;
    while (pos < len && depth > 0) {
      if (css[pos] === "{") depth++;
      else if (css[pos] === "}") depth--;
      pos++;
    }

    const body = css.slice(bodyStart, pos - 1).trim();
    if (selector) {
      blocks.push({ selector, body });
    }
  }

  return blocks;
}

/**
 * Дедуплицирует CSS:
 * 1. Одинаковые селекторы объединяются в одно правило (декларации мержатся, последние побеждают).
 * 2. Внутри правил удаляются повторяющиеся свойства (остаётся последнее).
 * 3. @media блоки обрабатываются рекурсивно, не ломая вложенность.
 * 4. @keyframes и шрифты сохраняются в первозданном виде.
 */
export function deduplicateCss(css: string): string {
  if (!css.trim()) return "";

  const blocks = parseTopBlocks(css);
  const rulesMap = new Map<string, Map<string, string>>();
  const order: string[] = [];
  const atRules: string[] = [];

  for (const block of blocks) {
    const sel = block.selector.trim();

    // Рекурсивная дедупликация внутри @media
    if (sel.toLowerCase().startsWith("@media")) {
      const dedupedInner = deduplicateCss(block.body);
      if (dedupedInner.trim()) {
        atRules.push(`${sel} {\n${dedupedInner}\n}`);
      }
      continue;
    }

    // @keyframes, @font-face и прочие at-rules не объединяем как обычные классы
    if (sel.startsWith("@")) {
      atRules.push(`${sel} {\n${block.body}\n}`);
      continue;
    }

    if (!rulesMap.has(sel)) {
      rulesMap.set(sel, new Map());
      order.push(sel);
    }

    const existing = rulesMap.get(sel)!;
    const incoming = parseDeclarations(block.body);
    for (const [prop, val] of incoming) {
      existing.set(prop, val);
    }
  }

  const result: string[] = [];

  for (const selector of order) {
    const decls = rulesMap.get(selector)!;
    if (decls.size === 0) continue;
    result.push(`${selector} {\n${serializeDeclarations(decls)}\n}`);
  }

  // At-rules (@media, @keyframes) добавляем после базовых правил
  for (const atRule of atRules) {
    result.push(atRule);
  }

  return result.join("\n\n");
}
