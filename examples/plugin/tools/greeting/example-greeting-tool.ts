import { z } from 'zod';
import { Context, BaseTool, untypedQueryOutputParser } from '@hashgraph/hedera-agent-kit';
import { Client } from '@hiero-ledger/sdk';

export const EXAMPLE_GREETING_TOOL = 'example_greeting_tool';

export class ExampleGreetingTool extends BaseTool {
  method = EXAMPLE_GREETING_TOOL;
  name = 'Example Greeting Tool';
  description = `
This is an example plugin tool that demonstrates how to create custom tools
using the v4 BaseTool pattern.

Parameters:
- name (str, required): The name of the person to greet
- language (str, optional): The language for the greeting. Can be "en", "es", "fr". Defaults to "en"

Usage:
Use this tool to generate personalized greetings in different languages.
`;

  parameters = z.object({
    name: z.string().min(1, 'Name is required'),
    language: z.enum(['en', 'es', 'fr']).optional().default('en'),
  });

  outputParser = untypedQueryOutputParser;

  async normalizeParams(
    params: { name: string; language?: string },
    _context: Context,
    _client: Client,
  ) {
    return params;
  }

  async coreAction(
    params: { name: string; language?: string },
    _context: Context,
    _client: Client,
  ) {
    const greetings: Record<string, string> = {
      en: `Hello, ${params.name}! Welcome to Hedera Agent Kit!`,
      es: `¡Hola, ${params.name}! ¡Bienvenido a Hedera Agent Kit!`,
      fr: `Bonjour, ${params.name}! Bienvenue dans Hedera Agent Kit!`,
    };
    const language = params.language ?? 'en';
    const greeting = greetings[language];
    return { raw: { greeting, language }, humanMessage: greeting };
  }

  async shouldSecondaryAction(_coreActionResult: any, _context: Context) {
    return false;
  }

  async secondaryAction(_result: any, _client: Client, _context: Context) {
    return null;
  }
}

const tool = (_context: Context): BaseTool => new ExampleGreetingTool();

export default tool;
