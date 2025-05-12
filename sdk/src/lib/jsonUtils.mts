/**
 * Utility functions for working with JSON in CLI output
 */

/**
 * Extract the last JSON object or array from a string that might contain multiple
 * JSON structures or other content.
 *
 * @param output - The string output that might contain JSON
 * @returns The parsed JSON object/array, or null if no valid JSON was found
 */
export function extractLastJson(output: string | undefined): any {
  if (!output) return null;

  try {
    // Try to find all JSON arrays in the output
    const arrayMatches = Array.from(output.matchAll(/(\[[\s\S]*?\])/g) || []);

    // Try to find all JSON objects in the output
    const objectMatches = Array.from(output.matchAll(/(\{[\s\S]*?\})/g) || []);

    // Get the positions of all matches
    const allMatches = [
      ...arrayMatches.map((match) => ({
        type: "array",
        match: match[1],
        index: match.index || 0,
      })),
      ...objectMatches.map((match) => ({
        type: "object",
        match: match[1],
        index: match.index || 0,
      })),
    ];

    // Sort by position in descending order to find the last match first
    allMatches.sort((a, b) => b.index - a.index);

    // Get the first item after sorting (which is the last in the original string)
    const lastMatch = allMatches.length > 0 ? allMatches[0] : null;

    if (lastMatch) {
      return JSON.parse(lastMatch.match);
    }

    // If no JSON objects or arrays were found, try parsing the entire output
    return JSON.parse(output);
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
    return defaultValue;
  }
}
