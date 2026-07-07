import {
  AbstractHook,
  AgentMode,
  PostSecondaryActionParams,
  PreToolExecutionParams,
} from '@/shared';
import { RawTransactionResponse } from '@/shared';
import { Client, TopicMessageSubmitTransaction } from '@hiero-ledger/sdk';

/**
 * Hook to add an audit trail of tool executions to a Hedera Consensus Service (HCS) topic.
 *
 * @remarks
 * **Autonomous mode only.** This hook only supports `AgentMode.AUTONOMOUS`.
 *
 * - In `RETURN_BYTES` mode it throws before the tool executes, because no transaction was
 *   submitted — there is nothing to audit.
 * - In `CUSTOM` mode it throws because the tool result shape is not guaranteed. A custom
 *   `TransactionStrategy` can return any structure, making reliable audit entries impossible.
 *   If you need audit trails in `CUSTOM` mode, implement a custom `AbstractHook` that reads
 *   the specific shape your strategy returns.
 *
 * **Requires a pre-existing topic.** The hook does not create an HCS topic. Create the topic
 * first — via the `create_topic_tool`.
 *
 * @warning If a paid topic (HIP-991: https://hips.hedera.com/hip/hip-991) is provided,
 * it could potentially drain the provided logging client's funds due to message submission fees.
 *
 * @see docs/HOOKS_AND_POLICIES.md — "HcsAuditTrailHook" for full setup and examples.
 */
export class HcsAuditTrailHook extends AbstractHook {
  relevantTools: string[];
  name: string;
  description: string;
  hcsTopicId: string;
  loggingClient?: Client;

  /**
   * @param relevantTools Tool names to audit (e.g. `['transfer_hbar', 'create_token']`).
   * @param hcsTopicId Id of a **pre-existing** HCS topic to log to — the hook does not create it.
   * @param loggingClient Optional client used to submit audit messages; defaults to the agent's
   *   operator client. Must be allowed to submit to `hcsTopicId`.
   */
  constructor(relevantTools: string[], hcsTopicId: string, loggingClient?: Client) {
    super();
    this.relevantTools = relevantTools;
    this.name = 'HCS Audit Trail Hook';
    this.description =
      'Hook to add audit trail to HCS messages. Supported only in AgentMode.AUTONOMOUS. Blocked in RETURN_BYTES and CUSTOM modes.';
    this.hcsTopicId = hcsTopicId;
    this.loggingClient = loggingClient;
  }

  async preToolExecutionHook(params: PreToolExecutionParams, method: string): Promise<any> {
    if (!this.relevantTools.includes(method)) return;

    if (
      params.context.mode === AgentMode.RETURN_BYTES ||
      params.context.mode === AgentMode.CUSTOM
    ) {
      throw new Error(
        `Unsupported hook: HcsAuditTrailHook only supports AgentMode.AUTONOMOUS. Stopping the agent execution before tool ${method} is executed.`,
      );
    }
  }

  async postToolExecutionHook(params: PostSecondaryActionParams, method: string): Promise<any> {
    if (!this.relevantTools.includes(method)) return;

    try {
      let targetClient = this.loggingClient;

      // HcsAuditTrailHook will use the agent's operator account client if no logging specific client is provided on hook initialization.
      if (!targetClient) {
        console.log(
          `HcsAuditTrailHook: No logging specific client provided. Using the agent's operator account client.`,
        );
        targetClient = params.client;
      }

      const fieldsToCastToString = [
        'accountId',
        'adminKey',
        'autoRenewAccountId',
        'contractId',
        'expirationTime',
        'feeScheduleKey',
        'freezeKey',
        'fromAddress',
        'functionParameters',
        'key',
        'kycKey',
        'metadataKey',
        'nftId',
        'nodeAccountId',
        'ownerAccountId',
        'pauseKey',
        'payerAccountID',
        'receiver',
        'recipientAddress',
        'recipientId',
        'scheduleId',
        'senderAccountId',
        'sourceAccountId',
        'spenderAccountId',
        'stakedAccountId',
        'submitKey',
        'supplyKey',
        'toAddress',
        'tokenId',
        'topicId',
        'transferAccountId',
        'treasuryAccountId',
        'wipeKey',
      ];

      // Create a clean copy for logging to avoid mutating the original
      const loggableParams = this.stringifyRecursive(
        { ...params.normalisedParams },
        fieldsToCastToString,
      );

      const logMessage: string = `Agent executed tool ${method} on with params ${JSON.stringify(loggableParams, null, 2)}.
    Transaction ID: ${(params.toolResult.raw as RawTransactionResponse).transactionId ?? 'N/A (query action)'}
    Transaction Status: ${(params.toolResult.raw as RawTransactionResponse).status ?? 'N/A (query action)'}
    Token ID: ${(params.toolResult.raw as RawTransactionResponse).tokenId ?? 'N/A'}
    Topic ID: ${(params.toolResult.raw as RawTransactionResponse).topicId ?? 'N/A '}
    Schedule ID: ${(params.toolResult.raw as RawTransactionResponse).scheduleId ?? 'N/A'}
    Account ID: ${(params.toolResult.raw as RawTransactionResponse).accountId ?? 'N/A'}
    `;
      await this.postMessageToHcsTopic(logMessage, targetClient);
    } catch (error) {
      console.error(`HcsAuditTrailHook: Failed to log audit entry for tool ${method}:`, error);
    }
  }

  private stringifyRecursive(obj: any, _fieldsToCastToString: string[]): any {
    // Handle primitives and null
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.stringifyRecursive(item, _fieldsToCastToString));
    }

    // Handle Uint8Array/Buffer - convert to hex string
    if (obj instanceof Uint8Array) {
      return `0x${Buffer.from(obj).toString('hex')}`;
    }

    // Handle SDK objects (AccountId, PublicKey, etc.) - they have custom toString methods
    if (obj.constructor?.name !== 'Object' && typeof obj.toString === 'function') {
      return obj.toString();
    }

    // Handle plain objects - recurse into properties
    const result: any = {};
    for (const key in obj) {
      result[key] = this.stringifyRecursive(obj[key], _fieldsToCastToString);
    }
    return result;
  }

  async postMessageToHcsTopic(message: string, client: Client) {
    const topicId = this.hcsTopicId;
    if (!topicId) return;

    const tx = new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(message);

    const response = await tx.execute(client);

    const receipt = await response.getReceipt(client);

    if (receipt.status.toString() !== 'SUCCESS') {
      console.error(
        `HcsAuditTrailHook: Failed to submit message to HCS topic ${topicId}: ${receipt.status.toString()}`,
      );
      return;
    }
  }
}
