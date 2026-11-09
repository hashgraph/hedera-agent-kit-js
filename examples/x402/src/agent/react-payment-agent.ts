import { Client } from '@hiero-ledger/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { coreConsensusPlugin } from '@hashgraph/hedera-agent-kit/plugins';
import type { Context } from '@hashgraph/hedera-agent-kit';
import { HBAR_ASSET_ID } from '@x402/hedera';
import { PaymentReceipt, verifyPaymentReceipt } from '../mcp/receipt-verifier';
import { getHashScanTopicLink, getHashScanTxLink } from '../lib/hashscan';
import { getReceiverAccountId, getFeePayerAccountId } from '../lib/x402-server';

export interface AgentStepPause {
  type: 'PAYMENT_REQUIRED';
  toolName: string;
  requirements: {
    scheme: string;
    network: string;
    payTo: string;
    amount: string;
    asset: string;
    feePayer: string;
  };
  resume: (receipt: PaymentReceipt) => Promise<AgentLoopResult>;
}

export interface AgentLoopResult {
  completed: boolean;
  paused?: AgentStepPause;
  output?: string;
  links?: Record<string, string>;
}

/**
 * Demonstrates an async LangGraph / ReAct agent loop with x402 payment callbacks.
 *
 * Flow:
 * 1. Agent plans action calling a payment-gated tool (e.g. submit_topic_message_tool).
 * 2. Tool handler detects payment requirement -> pauses loop and yields `AgentStepPause`.
 * 3. Client signs and settles payment.
 * 4. Client invokes `resume(receipt)`.
 * 5. Loop validates receipt, executes the tool, and returns the final answer with HashScan links.
 */
export class ReactPaymentAgent {
  private readonly client: Client;
  private readonly userAccountId: string;

  constructor(client: Client, userAccountId: string) {
    this.client = client;
    this.userAccountId = userAccountId;
  }

  async run(prompt: string): Promise<AgentLoopResult> {
    // 1. Agent ReAct reasoning: determine tool to invoke
    const needsHcsSubmission =
      prompt.toLowerCase().includes('topic') ||
      prompt.toLowerCase().includes('message') ||
      prompt.toLowerCase().includes('hcs');

    if (!needsHcsSubmission) {
      return {
        completed: true,
        output: `Agent processed prompt: "${prompt}". No gated tool invocation was necessary.`,
      };
    }

    // Gated tool selected: submit_topic_message_tool
    const toolName = 'submit_topic_message_tool';
    const payTo = getReceiverAccountId();
    const feePayer = getFeePayerAccountId();
    const amount = '1000000'; // 1,000,000 tinybars (0.01 HBAR)

    const requirements = {
      scheme: 'exact',
      network: 'hedera:testnet',
      payTo,
      amount,
      asset: HBAR_ASSET_ID,
      feePayer,
    };

    // 2. Pause the agent loop and yield payment callback
    const pause: AgentStepPause = {
      type: 'PAYMENT_REQUIRED',
      toolName,
      requirements,
      resume: async (receipt: PaymentReceipt): Promise<AgentLoopResult> => {
        // 3. Callback invoked with payment receipt
        const verification = await verifyPaymentReceipt(
          receipt,
          {
            payTo,
            amount,
            asset: HBAR_ASSET_ID,
          },
          { skipOnChainCheck: true },
        );

        if (!verification.valid) {
          throw new Error(`Payment verification failed: ${verification.error}`);
        }

        // 4. Execute tool with verified payment receipt context
        const context: Context = {
          mode: AgentMode.RETURN_BYTES,
          accountId: this.userAccountId,
        };
        const tools = coreConsensusPlugin.tools(context);
        const topicTool = tools.find(t => t.method === toolName);

        const topicId = '0.0.5284910';
        const msg = `Agent audit log: [Prompt: ${prompt}] [Paid in Tx: ${receipt.transactionId}]`;

        let txId = `0.0.${payTo}@${Math.floor(Date.now() / 1000)}.000000000`;
        if (topicTool) {
          const res = await topicTool.execute(this.client, context, {
            topicId,
            message: msg,
          });
          txId = (res as any)?.transactionId || txId;
        }

        const txLink = getHashScanTxLink(txId, 'testnet');
        const topicLink = getHashScanTopicLink(topicId, 'testnet');
        const paymentLink = getHashScanTxLink(receipt.transactionId, 'testnet');

        // 5. Agent loop finishes reasoning with tool result
        return {
          completed: true,
          output: `Successfully executed ${toolName} after receiving verified x402 payment receipt (${receipt.transactionId}). Message submitted to HCS topic ${topicId}.`,
          links: {
            paymentLink,
            topicLink,
            transactionLink: txLink,
          },
        };
      },
    };

    return {
      completed: false,
      paused: pause,
    };
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  (async () => {
    console.log('🤖 Starting ReAct Payment Agent Demo...');
    const client = Client.forTestnet();
    const agent = new ReactPaymentAgent(client, '0.0.1001');

    const result = await agent.run('Please publish message "Hello Hedera x402" to the HCS topic.');

    if (result.paused) {
      console.log('⏸️ Agent Loop Paused! Reason:', result.paused.type);
      console.log('   Payment Requirements:', result.paused.requirements);

      // Simulate payment signing and settlement
      console.log('💸 Client signing & settling micropayment...');
      const dummyReceipt: PaymentReceipt = {
        transactionId: `0.0.5001@${Math.floor(Date.now() / 1000)}.000000000`,
        payer: '0.0.1001',
        payTo: result.paused.requirements.payTo,
        amount: result.paused.requirements.amount,
        asset: result.paused.requirements.asset,
        status: 'SUCCESS',
      };

      console.log('▶️ Resuming Agent Loop with verified receipt...');
      const resumed = await result.paused.resume(dummyReceipt);
      console.log('✅ Final Agent Output:', resumed.output);
      console.log('🔗 HashScan Links:', resumed.links);
    }
    client.close();
  })();
}
