const jsonBlockPattern = /```(?:json)?\s*([\s\S]*?)```/;

/**
 * Custom implementation of JSON Parser form ElizaOS
 * Parses a JSON object or array from a given text.
 * Extracts JSON from code blocks and handles normalization of improperly formatted JSON.
 * Preserves data types (numbers, booleans, arrays) in the parsed result.
 *
 * @param text - The input text from which to extract and parse the JSON.
 * @returns The parsed JSON object or array if successful; otherwise, null.
 */
export function customParseJSONObjectFromText(text: string): Record<string, any> | any[] | null {
  if (!text) return null;

  let jsonData = null;
  const jsonBlockMatch = text.match(jsonBlockPattern);

  try {
    if (jsonBlockMatch) {
      // Clean the extracted JSON content
      const jsonContent = jsonBlockMatch[1].trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
      jsonData = JSON.parse(jsonContent);
    } else {
      // Try direct parsing first for well-formatted JSON
      try {
        jsonData = JSON.parse(text.trim());
      } catch {
        // Fall back to normalization for poorly formatted JSON
        jsonData = JSON.parse(customNormalizeJsonString(text.trim()));
      }
    }
  } catch (error) {
    console.warn('Could not parse text as JSON:', error);
    return null;
  }

  // Accept both objects and arrays, but ensure we have something valid
  if (jsonData && typeof jsonData === 'object') {
    return jsonData;
  }

  console.warn('Parsed result is not a valid object or array');
  return null;
}

/**
 * Custom Implementation of JSON string normalization from ElizaOS
 * Normalizes a JSON-like string by correcting formatting issues without converting numbers or booleans to strings.
 *
 * @param str - The JSON-like string to normalize.
 * @returns A properly formatted JSON string.
 */
function customNormalizeJsonString(str: string): string {
  if (!str) return str;

  // Remove extra spaces after '{' and before '}'
  str = str.replace(/\{\s+/, '{').replace(/\s+\}/, '}').trim();

  // Fix missing quotes around property names
  str = str.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');

  // Fix single quotes around property values but ONLY when they're strings
  // Don't convert numbers or booleans that are properly formatted
  str = str.replace(/"([^"]+)"\s*:\s*'([^']*)'/g, (_, key, value) => `"${key}": "${value}"`);

  // Handle unquoted property values that should be strings
  // But skip numbers, true, false, and null which should remain unquoted
  str = str.replace(/"([^"]+)"\s*:\s*([^",\{\[\]\}0-9][^",\{\[\]\}\s]*)/g, (match, key, value) => {
    // Skip if value is true, false, or null
    if (value === 'true' || value === 'false' || value === 'null') {
      return `"${key}": ${value}`;
    }
    // Skip if value is a number
    if (!isNaN(Number(value))) {
      return `"${key}": ${value}`;
    }
    return `"${key}": "${value}"`;
  });

  return str;
}
