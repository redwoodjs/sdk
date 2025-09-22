/**
 * Efficiently checks if a React directive (e.g., "use server", "use client")
 * is present in the code.
 *
 * This function is optimized for performance by only checking the first few
 * lines of the code, as directives must appear at the very top of a file.
 * It handles comments, whitespace, and any valid directive prologue
 * (e.g., "use strict").
 */
export function hasDirective(code: string, directive: string): boolean {
  const lines = code.slice(0, 512).split("\n"); // Check first ~512 chars
  let inMultiLineComment = false;

  const doubleQuoteDirective = `"${directive}"`;
  const singleQuoteDirective = `'${directive}'`;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      continue;
    }

    if (inMultiLineComment) {
      if (trimmedLine.includes("*/")) {
        inMultiLineComment = false;
      }
      continue;
    }

    if (trimmedLine.startsWith("/*")) {
      if (!trimmedLine.includes("*/")) {
        inMultiLineComment = true;
      }
      continue;
    }

    if (trimmedLine.startsWith("//")) {
      continue;
    }

    const cleanedLine = trimmedLine.endsWith(";")
      ? trimmedLine.slice(0, -1)
      : trimmedLine;

    if (
      trimmedLine.startsWith(doubleQuoteDirective) ||
      trimmedLine.startsWith(singleQuoteDirective)
    ) {
      return true;
    }

    // Any other string literal is part of a valid directive prologue.
    // We can continue searching.
    if (trimmedLine.startsWith('"') || trimmedLine.startsWith("'")) {
      continue;
    }

    // If we encounter any other non-directive, non-comment, non-string-literal
    // line of code, the directive prologue is over. Stop.
    break;
  }

  return false;
}
