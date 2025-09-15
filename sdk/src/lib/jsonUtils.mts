/**
 * Utility functions for working with JSON in CLI output
 */

/**
 * Attempt to extract the last JSON object or array from a string by
 * first finding closing braces/brackets and then matching them to their
 * opening counterparts.
 *
 * @param output - The string to parse
 * @returns JSON object or null if invalid
 */
export function extractLastJson(output: string | undefined): any {
  if (!output) return null;

  try {
    // First try a direct parse of the entire output
    // (in case it's already valid JSON with no surrounding text)
    try {
      return JSON.parse(output);
    } catch (e) {
      // If that fails, try more complex extraction
    }

    // Start from the end of the string to find closing braces/brackets
    for (let i = output.length - 1; i >= 0; i--) {
      // Look for closing braces/brackets
      if (output[i] === "}" || output[i] === "]") {
        const closingChar = output[i];
        const openingChar = closingChar === "}" ? "{" : "[";

        // Find the matching opening brace/bracket
        let balance = 1; // Start with 1 since we've already found a closing char
        let j = i - 1;

        while (j >= 0 && balance > 0) {
          if (output[j] === closingChar) {
            balance++;
          } else if (output[j] === openingChar) {
            balance--;
            // If balance is 0, we found the matching opening char
            if (balance === 0) {
              // Extract the potential JSON and try to parse it
              const extracted = output.substring(j, i + 1);
              try {
                const parsed = JSON.parse(extracted);
                return parsed;
              } catch (e) {
                // Not valid JSON, continue
                break;
              }
            }
          }
          j--;
        }
      }
    }

    // If we reach here, no valid JSON was found
    return null;
  } catch (error) {
    console.error("Error extracting last JSON:", error);
    return null;
  }
}

/**
 * Extract all valid JSON objects or arrays from a string
 *
 * @param input - The string that might contain multiple JSON objects
 * @returns Array of parsed JSON objects
 */
export function extractAllJson(input: string | undefined): any[] {
  if (!input) return [];

  const results: any[] = [];
  let remainingText = input;

  // Try to extract JSON objects until no more are found
  while (remainingText.length > 0) {
    // Find opening braces/brackets
    const openBracePos = remainingText.indexOf("{");
    const openBracketPos = remainingText.indexOf("[");

    // Determine which comes first (if any)
    let startPos = -1;
    let openChar = "";
    let closeChar = "";

    if (
      openBracePos >= 0 &&
      (openBracketPos < 0 || openBracePos < openBracketPos)
    ) {
      startPos = openBracePos;
      openChar = "{";
      closeChar = "}";
    } else if (openBracketPos >= 0) {
      startPos = openBracketPos;
      openChar = "[";
      closeChar = "]";
    } else {
      // No more opening braces/brackets
      break;
    }

    // Cut off the text before the opening character
    remainingText = remainingText.substring(startPos);

    // Find the matching closing character
    let balance = 1;
    let endPos = 1; // Start after the opening character

    while (endPos < remainingText.length && balance > 0) {
      if (remainingText[endPos] === openChar) {
        balance++;
      } else if (remainingText[endPos] === closeChar) {
        balance--;
      }
      endPos++;
    }

    // Check if we found a complete JSON object
    if (balance === 0) {
      const potentialJson = remainingText.substring(0, endPos);
      try {
        const parsed = JSON.parse(potentialJson);
        results.push(parsed);
      } catch (e) {
        // Not valid JSON, just ignore
      }

      // Continue with text after this JSON object
      remainingText = remainingText.substring(endPos);
    } else {
      // Unbalanced braces/brackets, skip this one
      remainingText = remainingText.substring(1);
    }
  }

  return results;
}

/**
 * Safely parses JSON from a string that might include other content
 *
 * @param input - The string that might contain JSON
 * @param defaultValue - Default value to return if no JSON is found
 * @param findUuid - If true, look for an object with a uuid property
 * @returns The parsed JSON or the default value
 */
export function parseJson<T>(
  input: string | undefined,
  defaultValue: T,
  findUuid: boolean = false,
): T {
  try {
    // Try to find the last complete JSON object
    const lastJson = extractLastJson(input);
    if (lastJson !== null) {
      if (!findUuid || lastJson.uuid) {
        return lastJson;
      }
    }

    // If we need to find an object with a uuid property, try extracting all JSON objects
    if (findUuid) {
      const allJson = extractAllJson(input);
      // Look for an object that has a uuid property
      for (const json of allJson) {
        if (json && json.uuid) {
          return json as T;
        }
      }
    }

    if (lastJson !== null) {
      return lastJson;
    }

    return defaultValue;
  } catch (error) {
    console.error("Error in parseJson:", error);
    return defaultValue;
  }
}
