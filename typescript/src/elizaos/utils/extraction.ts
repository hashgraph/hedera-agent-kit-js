import { Tool } from '@/shared';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Generates an extraction template based on the tool description, params and zod schema.
 * @param tool
 */
export function generateExtractionTemplate(tool: Tool): string {
  const zodSchema = tool.parameters; // Zod Schema of the tool parameters, used for generating JSON schema for extraction response
  const description = tool.description; // description of the tool, used for generating a list of required/optional params
  const actionName = tool.name;
  const toolParamsJSONSchema = zodToJsonSchema(zodSchema, actionName); // JSON schema created based on the tool's params

  return `Given the recent messages and Hedera wallet information below:
{{recentMessages}}
{{hederaAccountDetails}}

Extract the following parameters based on the tool/action description and json schema below:

### Tool/action description:
${description}

⚠️ Do **not** assume values or apply defaults. Do **not** set a field unless it is clearly specified in the latest user input.
⚠️ **IMPORTANT**: Always ensure numeric values are provided as NUMBERS WITHOUT QUOTES in the JSON response.
⚠️ **IMPORTANT**: Always ensure string values are provided as QUOTED STRINGS in the JSON response.
⚠️ **CRITICAL**: Enum values must be provided as QUOTED STRINGS (e.g., "finite", not finite).
⚠️ **CRITICAL**: The returned JSON must be a valid JSON object in markdown format. Don not include comments inside it. If no params is passed return an empty JSON object.

---

### Response format:
Respond with a JSON markdown block including the fields that were explicitly mentioned in the most recent user message.

Response JSON schema:
${JSON.stringify(toolParamsJSONSchema, null, 2)}

---

Numeric values should be numbers without quotes. Enum values must be quoted strings.`;
}
