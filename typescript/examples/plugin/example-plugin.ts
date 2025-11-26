import { z } from 'zod';
import {
  Plugin,
  Context,
  Tool,
  handleTransaction,
  PromptGenerator,
  AccountResolver,
} from 'hedera-agent-kit';
import { Client, TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk';
import { transactionToolOutputParser } from '../../src';

// Example: Simple greeting tool
const createGreetingTool = (_context: Context): Tool => ({
  method: 'example_greeting_tool',
  name: 'Example Greeting Tool',
  description: `
This is an example plugin tool that demonstrates how to create custom tools.

Parameters:
- name (str, required): The name of the person to greet
- language (str, optional): The language for the greeting. Can be "en", "es", "fr". Defaults to "en"

Usage:
Use this tool to generate personalized greetings in different languages.
`,
  outputParser: undefined, // will use default parser on extracted dool response
  parameters: z.object({
    name: z.string().min(1, 'Name is required'),
    language: z.enum(['en', 'es', 'fr']).optional().default('en'),
  }),
  execute: async (
    client: Client,
    context: Context,
    params: { name: string; language?: string },
  ) => {
    const greetings = {
      en: `Hello, ${params.name}! Welcome to Hedera Agent Kit!`,
      es: `¡Hola, ${params.name}! ¡Bienvenido a Hedera Agent Kit!`,
      fr: `Bonjour, ${params.name}! Bienvenue dans Hedera Agent Kit!`,
    };

    const language = params.language || 'en';
    // @ts-ignore
    return greetings[language];
  },
});

// Example: HBAR Transfer tool that uses the transaction strategy
const createHbarTransferTool = (context: Context): Tool => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
    'sourceAccountId',
    context,
  );
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return {
    method: 'example_hbar_transfer_tool',
    name: 'Example HBAR Transfer',
    description: `
${contextSnippet}

This example plugin tool demonstrates how to create HBAR transfers using the Hedera Agent Kit transaction strategy pattern.
It will transfer HBAR to account 0.0.800 as a demonstration.

Parameters:
- hbarAmount (number, required): Amount of HBAR to transfer to account 0.0.800
- ${sourceAccountDesc}
- transactionMemo (str, optional): Optional memo for the transaction

${usageInstructions}
`,
    parameters: z.object({
      hbarAmount: z.number().positive('HBAR amount must be positive'),
      sourceAccountId: z.string().optional(),
      transactionMemo: z.string().optional(),
    }),
    outputParser: transactionToolOutputParser, // will default parsing function for transaction tools - tools executing on-chain transactions with hedera agent kit
    execute: async (
      client: Client,
      context: Context,
      params: { hbarAmount: number; sourceAccountId?: string; transactionMemo?: string },
    ) => {
      try {
        const sourceAccount = AccountResolver.resolveAccount(
          params.sourceAccountId,
          context,
          client,
        );

        // Create the transfer transaction
        const destinationAccount = AccountId.fromString('0.0.800');
        const transferAmount = new Hbar(params.hbarAmount);

        const transferTransaction = new TransferTransaction()
          .addHbarTransfer(sourceAccount, transferAmount.negated())
          .addHbarTransfer(destinationAccount, transferAmount);

        // Add memo if provided
        if (params.transactionMemo) {
          transferTransaction.setTransactionMemo(params.transactionMemo);
        }

        // Use the handleTransaction strategy - this will either execute or return bytes
        // depending on the context.mode (AUTONOMOUS vs RETURN_BYTES)
        const result = await handleTransaction(transferTransaction, client, context);
        return result;
      } catch (error) {
        console.error('[ExampleHbarTransfer] Error:', error);
        if (error instanceof Error) {
          return `Failed to transfer HBAR: ${error.message}`;
        }
        return 'Failed to transfer HBAR';
      }
    },
  };
};

// Export the plugin
export const examplePlugin: Plugin = {
  name: 'example-plugin',
  version: '1.0.0',
  description:
    'An example plugin demonstrating how to create custom tools for Hedera Agent Kit, including real Hedera transactions',
  tools: (context: Context) => [createGreetingTool(context), createHbarTransferTool(context)],
};

export default examplePlugin;
