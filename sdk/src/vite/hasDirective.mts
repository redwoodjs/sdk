/**
 * Efficiently checks if a React directive (e.g., "use server", "use client")
 * is present in the code. Optimized for performance with a two-step approach:
 * 1. Quick string search to see if directive exists anywhere
 * 2. Line-by-line check only if the directive might be present
 */
export function hasDirective(code: string, directive: string): boolean {
  // Quick performance check: if directive doesn't exist anywhere, skip line checking
  const singleQuoteDirective = `'${directive}'`;
  const doubleQuoteDirective = `"${directive}"`;

  if (
    !code.includes(singleQuoteDirective) &&
    !code.includes(doubleQuoteDirective)
  ) {
    return false;
  }

  // Split into lines and check each one
  const lines = code.split("\n");
  let inMultiLineComment = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (trimmedLine.length === 0) {
      continue;
    }

    // Handle multi-line comments
    if (trimmedLine.startsWith("/*")) {
      inMultiLineComment = true;
      // Check if the comment ends on the same line
      if (trimmedLine.includes("*/")) {
        inMultiLineComment = false;
      }
      continue;
    }

    if (inMultiLineComment) {
      // Check if this line ends the multi-line comment
      if (trimmedLine.includes("*/")) {
        inMultiLineComment = false;
      }
      continue;
    }

    // Skip single-line comments
    if (trimmedLine.startsWith("//")) {
      continue;
    }

    // Check if this line starts with the directive
    if (
      trimmedLine.startsWith(doubleQuoteDirective) ||
      trimmedLine.startsWith(singleQuoteDirective)
    ) {
      return true;
    }

    // If we hit a non-empty, non-comment line that's not a directive, we can stop
    // (directives must be at the top of the file/scope, after comments)
    break;
  }

  return false;
}
