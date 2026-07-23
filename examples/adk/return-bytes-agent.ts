/**
 * RETURN_BYTES example for Google ADK.
 *
 * Invokes a Hedera ADK tool directly (no LLM/Gemini key, nothing submitted) so you can see the
 * full ReturnBytesResult envelope a transaction tool returns in RETURN_BYTES mode. For the same
 * envelope inside a live LLM flow, adapt plugin-tool-calling-agent.ts to AgentMode.RETURN_BYTES.
 * Needs only ACCOUNT_ID — the transaction is frozen locally, never signed or submitted.
 */
import { Client, Transaction } from '@hiero-ledger/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { HederaADKToolkit } from '@hashgraph/hedera-agent-kit-adk';
import { coreAccountPlugin, coreAccountPluginToolNames } from '@hashgraph/hedera-agent-kit/plugins';
import * as dotenv from 'dotenv';

dotenv.config();

function validateEnv() {
  if (!process.env.ACCOUNT_ID) {
    console.error('Missing required environment variable: ACCOUNT_ID');
    console.error('Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
}

// After the JSON round-trip through the ADK adapter, `bytes` is a numeric-keyed object, not a
// Uint8Array — rebuild it.
function toUint8Array(bytes: any): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes?.type === 'Buffer' && Array.isArray(bytes.data)) return new Uint8Array(bytes.data);
  if (Array.isArray(bytes)) return new Uint8Array(bytes);
  if (bytes && typeof bytes === 'object') return new Uint8Array(Object.values(bytes) as number[]);
  return new Uint8Array();
}

async function main(): Promise<void> {
  validateEnv();

  const accountId = process.env.ACCOUNT_ID!;
  const client = Client.forTestnet(); // no operator: RETURN_BYTES only freezes locally

  const toolkit = new HederaADKToolkit({
    client,
    configuration: {
      plugins: [coreAccountPlugin],
      tools: [], // empty = load all tools from the plugin
      context: {
        mode: AgentMode.RETURN_BYTES,
        accountId, // required in RETURN_BYTES: the payer for the generated transaction ID
      },
    },
  });

  const tool = toolkit
    .getTools()
    .find(t => t.name === coreAccountPluginToolNames.TRANSFER_HBAR_TOOL);
  if (!tool) throw new Error(`${coreAccountPluginToolNames.TRANSFER_HBAR_TOOL} not found`);

  const envelope: any = await tool.runAsync({
    args: { transfers: [{ accountId: '0.0.1234', amount: 1 }] },
    toolContext: {} as any, // ignored by the Hedera tool's execute()
  });

  const bytes = toUint8Array(envelope.bytes);

  console.log('--- RETURN_BYTES envelope ---');
  console.log(
    JSON.stringify(
      {
        status: envelope.status,
        type: envelope.type,
        transactionId: envelope.transactionId,
        payerAccountId: envelope.payerAccountId,
        expiresAt: envelope.expiresAt,
        memo: envelope.memo,
        bytesLength: bytes.length,
      },
      null,
      2,
    ),
  );

  // The bytes deserialize into a signable transaction — what you would hand to a wallet.
  const tx = Transaction.fromBytes(bytes);
  console.log('\nDeserialized transaction ID:', tx.transactionId?.toString());
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
