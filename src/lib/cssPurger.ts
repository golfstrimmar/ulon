/**
 * @file cssPurger.ts
 * @description Удаляет CSS-правила, чьи селекторы не используются в HTML.
 * Работает полностью в браузере, без внешних зависимостей.
 */

export interface PurgeResult {
  css: string;
  kept: number;
  removed: number;
}

/** Парсит все имена классов из HTML-строки */
function extractClassesFromHtml(html: string): Set<string> {
  const classes = new Set<string>();
  // Собираем всё из class="..." и class='...'
  const classAttrRe = /class=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = classAttrRe.exec(html)) !== null) {
    m[1].split(/\s+/).forEach((cls) => cls && classes.add(cls));
  }
  return classes;
}

/** Разбивает CSS на массив блоков {selector, body} с учётом вложенных фигурных скобок */
function parseCssBlocks(css: string): Array<{ selector: string; body: string; raw: string }> {
  const blocks: Array<{ selector: string; body: string; raw: string }> = [];
  let pos = 0;
  const len = css.length;

  while (pos < len) {
    // Пропускаем пробелы
    while (pos < len && /\s/.test(css[pos])) pos++;
    if (pos >= len) break;

    // Собираем селектор до первой {
    const selectorStart = pos;
    const bracePos = css.indexOf("{", pos);
    if (bracePos === -1) break;

    const selector = css.slice(selectorStart, bracePos).trim();
    pos = bracePos + 1;

    // Читаем тело с учётом вложенности (media queries, keyframes и т.д.)
    let depth = 1;
    const bodyStart = pos;
    while (pos < len && depth > 0) {
      if (css[pos] === "{") depth++;
      else if (css[pos] === "}") depth--;
      pos++;
    }
    const body = css.slice(bodyStart, pos - 1).trim();
    const raw = `${selector} {\n${body}\n}`;

    if (selector) {
      blocks.push({ selector, body, raw });
    }
  }

  return blocks;
}

/**
 * Определяет, нужно ли всегда сохранять блок (не зависит от classlist HTML)
 * — :root, *, html, body, @media, @keyframes, @font-face и т.д.
 */
function isAlwaysKept(selector: string): boolean {
  const s = selector.trim().toLowerCase();
  return (
    s.startsWith("@") ||          // @media, @keyframes, @font-face, @charset, @import
    s === ":root" ||
    s === "*" ||
    s === "*, *::before, *::after" ||
    s.startsWith("*, *") ||
    s === "html" ||
    s === "body" ||
    s === "html, body" ||
    s.startsWith("html ") ||
    s.startsWith("body ") ||
    s.startsWith(":root") ||
    // element-only селекторы (h1, p, a, img, ...) — без точки и #
    /^[a-z][a-z0-9]*(\s*,\s*[a-z][a-z0-9]*)*$/i.test(s)
  );
}

/**
 * Извлекает имена классов из селектора CSS
 * ".card-header .title:hover" → ["card-header", "title"]
 */
function extractClassesFromSelector(selector: string): string[] {
  const classes: string[] = [];
  const re = /\.([a-zA-Z0-9_.-]+?)(?=[:\s{]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(selector)) !== null) {
    classes.push(m[1]);
  }
  return classes;
}

/**
 * Удаляет неиспользуемые CSS-правила на основе classlist из HTML.
 * Всегда сохраняет: :root, *, html, body, @media, @keyframes и т.д.
 */
export function purgeUnusedCss(html: string, css: string): PurgeResult {
  if (!css.trim()) return { css: "", kept: 0, removed: 0 };

  const usedClasses = extractClassesFromHtml(html);
  const blocks = parseCssBlocks(css);

  let kept = 0;
  let removed = 0;
  const keptBlocks: string[] = [];

  for (const block of blocks) {
    // @media, @keyframes и т.д. — рекурсивно фильтруем их содержимое
    if (block.selector.trim().startsWith("@media")) {
      const inner = purgeUnusedCss(html, block.body);
      if (inner.css.trim()) {
        keptBlocks.push(`${block.selector} {\n${inner.css}\n}`);
        kept += inner.kept;
        removed += inner.removed;
      }
      continue;
    }

    if (isAlwaysKept(block.selector)) {
      keptBlocks.push(block.raw);
      kept++;
      continue;
    }

    // Проверяем все классы в селекторе — достаточно одного используемого
    const selectorClasses = extractClassesFromSelector(block.selector);
    const isUsed =
      selectorClasses.length === 0 ||
      selectorClasses.some((cls) => usedClasses.has(cls));

    if (isUsed) {
      keptBlocks.push(block.raw);
      kept++;
    } else {
      removed++;
    }
  }

  return {
    css: keptBlocks.join("\n\n"),
    kept,
    removed,
  };
}
