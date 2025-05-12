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
 * Safely parses JSON from a string that might include other content
 *
 * @param input - The string that might contain JSON
 * @param defaultValue - Default value to return if no JSON is found
 * @returns The parsed JSON or the default value
 */
export function parseJson<T>(input: string | undefined, defaultValue: T): T {
  try {
    const result = extractLastJson(input);
    return result !== null ? result : defaultValue;
  } catch (error) {
    console.error("Error in parseJson:", error);
    return defaultValue;
  }
}
