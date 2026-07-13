/**
 * Plugin smoke test — no LLM, no operator credentials, no funds moved.
 *
 * Demonstrates the minimal way to test a custom plugin:
 *   1. Instantiate the plugin and check its shape.
 *   2. Call a non-transaction tool directly via tool.execute().
 *   3. Dry-run a transaction tool in RETURN_BYTES mode — the transaction is
 *      built and frozen, but never signed or submitted.
 *   4. Attach a hook to verify the v4 lifecycle fires. Swap the inline hook
 *      for HcsAuditTrailHook to get an on-chain audit trail — see
 *      docs/HOOKS_AND_POLICIES.md.
 *
 * Run: npx tsx smoke-test.ts
 */

import assert from 'node:assert';
import { Client } from '@hiero-ledger/sdk';
import { AbstractHook, AgentMode, Context } from '@hashgraph/hedera-agent-kit';
import examplePlugin from './example-plugin';

// Minimal recording hook — proves the lifecycle runs without touching HCS.
class RecordingHook extends AbstractHook {
  name = 'recording-hook';
  description = 'Counts lifecycle invocations for assertions';
  relevantTools = ['example_greeting_tool'];
  calls = 0;

  async preToolExecutionHook(_params: any, method: string) {
    if (!this.relevantTools.includes(method)) return;
    this.calls++;
  }
}

async function main() {
  // No operator needed: nothing in this test signs or submits anything.
  const client = Client.forTestnet();
  const context: Context = { mode: AgentMode.RETURN_BYTES, accountId: '0.0.1001' };

  // 1. Plugin shape
  const tools = examplePlugin.tools(context);
  assert.equal(examplePlugin.name, 'example-plugin');
  assert.equal(tools.length, 2);

  // 2. Non-transaction tool: call execute() directly — no LLM in the loop
  const greeting = tools.find(t => t.method === 'example_greeting_tool');
  assert.ok(greeting, 'greeting tool is registered');
  const greetingResult = await greeting.execute(client, context, {
    name: 'Hedera',
    language: 'es',
  });
  assert.equal(greetingResult, '¡Hola, Hedera! ¡Bienvenido a Hedera Agent Kit!');

  // 3. Transaction tool dry run: RETURN_BYTES builds and freezes the
  //    transaction, then returns its bytes instead of submitting it.
  const transfer = tools.find(t => t.method === 'example_hbar_transfer_tool');
  assert.ok(transfer, 'transfer tool is registered');
  const transferResult = await transfer.execute(client, context, { hbarAmount: 1 });
  assert.ok(
    transferResult.bytes instanceof Uint8Array && transferResult.bytes.length > 0,
    `expected frozen transaction bytes, got: ${JSON.stringify(transferResult)}`,
  );

  // 4. Hooks fire for BaseTool-based tools
  const hook = new RecordingHook();
  await greeting.execute(client, { ...context, hooks: [hook] }, { name: 'Hedera' });
  assert.equal(hook.calls, 1, 'expected the hook to fire exactly once');

  console.log('✔ plugin smoke test passed');
  client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
