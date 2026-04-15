/**
 * Example Plugin — demonstrating the v4 BaseTool pattern.
 *
 * Key points:
 *  - Tools now extend BaseTool instead of returning a plain Tool object literal.
 *  - BaseTool implements the Tool interface, so this is a NON-BREAKING change:
 *    Plugin.tools() still returns Tool[], and all framework adapters (LangChain,
 *    AI SDK, MCP …) accept BaseTool instances without any modification.
 *  - Only BaseTool-based tools participate in the hooks and policies system
 *    introduced in v4 (HcsAuditTrailHook, MaxRecipientsPolicy, RejectToolPolicy …).
 */

import { z } from 'zod';
import {
  Plugin,
  Context,
  BaseTool, // ← v4: use BaseTool, not the plain Tool type
  handleTransaction,
  PromptGenerator,
  AccountResolver,
} from '@hashgraph/hedera-agent-kit';
import { Client, TransferTransaction, Hbar, AccountId } from '@hiero-ledger/sdk';
import { transactionToolOutputParser } from '@hashgraph/hedera-agent-kit';

// ─── Tool 1: Greeting tool (no Hedera transaction) ────────────────────────────

/**
 * ExampleGreetingTool extends BaseTool so it participates in the
 * hook/policy lifecycle even though it performs no on-chain action.
 *
 * For a pure utility tool like this there is no real "secondary action"
 * (no transaction to sign), so we override shouldSecondaryAction()
 * to return false and provide a no-op secondaryAction().
 */
export class ExampleGreetingTool extends BaseTool {
  // ── Tool identity ─────────────────────────────────────────────────────────
  method = 'example_greeting_tool';
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

  // ── Zod schema describing the parameters the LLM must provide ─────────────
  parameters = z.object({
    name: z.string().min(1, 'Name is required'),
    language: z.enum(['en', 'es', 'fr']).optional().default('en'),
  });

  // outputParser is optional for non-transaction tools; undefined = default parser
  outputParser = undefined;

  // ── Stage 2: Parameter normalization ─────────────────────────────────────
  // No real normalization needed for this simple tool; pass params through.
  async normalizeParams(
    params: { name: string; language?: string },
    _context: Context,
    _client: Client,
  ) {
    return params;
  }

  // ── Stage 4: Core action ──────────────────────────────────────────────────
  // Build the greeting. For non-transaction tools this is the only real stage.
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
    return greetings[params.language ?? 'en'];
  }

  // ── Skip the secondary action: nothing to sign/submit ────────────────────
  async shouldSecondaryAction(_coreActionResult: any, _context: Context) {
    return false;
  }

  // secondaryAction is required by the abstract class; provide a no-op.
  async secondaryAction(_result: any, _client: Client, _context: Context) {
    return null;
  }
}

// ─── Tool 2: HBAR transfer tool (real on-chain transaction) ──────────────────

/**
 * ExampleHbarTransferTool extends BaseTool and splits the logic into the
 * three abstract lifecycle stages required by BaseTool:
 *
 *   normalizeParams  → resolve the source account from context/params
 *   coreAction       → build the TransferTransaction (no signing yet)
 *   secondaryAction  → sign and submit via handleTransaction()
 *
 * Because the logic is split this way, hooks (e.g. HcsAuditTrailHook) and
 * policies (e.g. MaxRecipientsPolicy) can inspect the transaction BEFORE
 * it is submitted — a capability that was impossible with the v3 pattern.
 */
export class ExampleHbarTransferTool extends BaseTool {
  // ── Tool identity ─────────────────────────────────────────────────────────
  method = 'example_hbar_transfer_tool';
  name = 'Example HBAR Transfer';
  description: string; // built in constructor, context-dependent
  parameters: z.ZodObject<any, any>; // built in constructor, context-dependent

  // transactionToolOutputParser: recommended for LangChain v1.
  // It normalises the result into { raw, humanMessage } format.
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();

    // Build the context-aware description (same as the old factory function).
    const contextSnippet = PromptGenerator.getContextSnippet(context);
    const sourceAccountDesc = PromptGenerator.getAccountParameterDescription(
      'sourceAccountId',
      context,
    );
    const usageInstructions = PromptGenerator.getParameterUsageInstructions();

    this.description = `
${contextSnippet}

This example plugin tool demonstrates how to create HBAR transfers using the
Hedera Agent Kit transaction strategy pattern (v4 BaseTool approach).
It will transfer HBAR to account 0.0.800 as a demonstration.

Parameters:
- hbarAmount (number, required): Amount of HBAR to transfer to account 0.0.800
- ${sourceAccountDesc}
- transactionMemo (str, optional): Optional memo for the transaction

${usageInstructions}
`;

    this.parameters = z.object({
      hbarAmount: z.number().positive('HBAR amount must be positive'),
      sourceAccountId: z.string().optional(),
      transactionMemo: z.string().optional(),
    });
  }

  // ── Stage 2: Parameter normalisation ─────────────────────────────────────
  // Resolve the source account from the context or explicit param.
  // BaseTool calls postParamsNormalizationHook after this returns,
  // giving policies (like MaxRecipientsPolicy) a chance to inspect params.
  async normalizeParams(
    params: { hbarAmount: number; sourceAccountId?: string; transactionMemo?: string },
    context: Context,
    client: Client,
  ) {
    const sourceAccount = AccountResolver.resolveAccount(params.sourceAccountId, context, client);
    return { ...params, resolvedSourceAccount: sourceAccount };
  }

  // ── Stage 4: Core action ──────────────────────────────────────────────────
  // Build the TransferTransaction. Do NOT sign or submit here.
  // BaseTool will run postCoreActionHook after this returns, allowing
  // hooks to inspect the unsigned transaction before submission.
  async coreAction(
    normalisedParams: {
      hbarAmount: number;
      resolvedSourceAccount: AccountId;
      transactionMemo?: string;
    },
    _context: Context,
    _client: Client,
  ) {
    const destinationAccount = AccountId.fromString('0.0.800');
    const transferAmount = new Hbar(normalisedParams.hbarAmount);

    const tx = new TransferTransaction()
      .addHbarTransfer(normalisedParams.resolvedSourceAccount, transferAmount.negated())
      .addHbarTransfer(destinationAccount, transferAmount);

    if (normalisedParams.transactionMemo) {
      tx.setTransactionMemo(normalisedParams.transactionMemo);
    }

    return tx;
  }

  // ── Stage 6: Secondary action ─────────────────────────────────────────────
  // Sign and submit the transaction using the handleTransaction strategy.
  // This respects context.mode (AUTONOMOUS vs RETURN_BYTES) automatically.
  async secondaryAction(transaction: TransferTransaction, client: Client, context: Context) {
    return await handleTransaction(transaction, client, context);
  }

  // ── Error handling ────────────────────────────────────────────────────────
  // Override BaseTool.handleError() for a tool-specific error message.
  async handleError(error: unknown, _context: Context): Promise<any> {
    console.error('[ExampleHbarTransfer] Error:', error);
    const message =
      'Failed to transfer HBAR' + (error instanceof Error ? `: ${error.message}` : '');
    return message;
  }
}

// ─── Plugin definition ────────────────────────────────────────────────────────

/**
 * The plugin definition is unchanged from v3: Plugin.tools() returns Tool[],
 * and BaseTool instances satisfy the Tool interface, so no other code needs
 * to change when adopting BaseTool.
 */
export const examplePlugin: Plugin = {
  name: 'example-plugin',
  version: '1.0.0',
  description:
    'An example plugin demonstrating the v4 BaseTool pattern for Hedera Agent Kit. ' +
    'BaseTool-based tools are fully compatible with hooks and policies.',
  tools: (context: Context) => [new ExampleGreetingTool(), new ExampleHbarTransferTool(context)],
};

export default examplePlugin;
