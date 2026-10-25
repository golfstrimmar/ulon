/**
 * @file jsCompiler.ts
 * @description Чистый JS-бандл без искусственных оберток и матрёшек.
 */

/**
 * Встраивает или обновляет именной скрипт внутри единого глобального JS-бандла.
 */
export function updateScriptInGlobalBundle(
  globalJs: string,
  targetName: string,
  code: string,
): string {
  const cleanTarget = targetName.trim().replace(/^\./, "");
  const trimmedCode = (code || "").trim();
  if (!cleanTarget) return globalJs;

  const startMarker = `/* --- [script:${cleanTarget}] --- */`;
  const endMarker = `/* --- [end:${cleanTarget}] --- */`;

  // Ищем и вырезаем старую версию этого скрипта
  const blockRegex = new RegExp(
    `\\/\\* --- \\[script:${cleanTarget}\\] --- \\*[\\s\\S]*?\\/\\* --- \\[end:${cleanTarget}\\] --- \\*\\n?`,
    "g",
  );

  const cleanedBundle = (globalJs || "").replace(blockRegex, "").trim();

  // Если код удалили
  if (!trimmedCode) {
    return cleanedBundle;
  }

  // Записываем чистый скрипт без лишних try/catch и анонимных функций
  const newBlock = `${startMarker}\n${trimmedCode}\n${endMarker}`;

  return cleanedBundle ? `${cleanedBundle}\n\n${newBlock}` : newBlock;
}

/**
 * Подготовка для превью: отдаем чистый JS код как есть
 */
export function prepareScriptsForExecution(globalJs: string): string {
  return (globalJs || "").trim();
}

/**
 * Для обратной совместимости
 */
export function compileScriptsBundle(scriptsJs: any): string {
  if (typeof scriptsJs === "string") return scriptsJs.trim();
  if (scriptsJs?.__bundle__) return scriptsJs.__bundle__.trim();
  return Object.values(scriptsJs || {})
    .join("\n\n")
    .trim();
}
