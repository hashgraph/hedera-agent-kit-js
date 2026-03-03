import { AbstractHook, HookExecInterruptError, PostSecondaryActionParams } from '@/shared';
import { AgentMode, Context } from '@/shared';
import { RawTransactionResponse } from '@/shared';
import { Client, TopicMessageSubmitTransaction } from '@hashgraph/sdk';


/**
 * Hook to add an audit trail of tool executions to a Hedera Consensus Service (HCS) topic.
 * 
 * @warning If a paid topic (HIP-991: https://hips.hedera.com/hip/hip-991) is provided,
 * it could potentially drain the provided logging client's funds due to message submission fees.
 */
export class HcsAuditTrailHook extends AbstractHook {
  relevantTools: string[];
  name: string;
  description: string;
  hcsTopicId: string;
  loggingClient: Client;

  constructor(relevantTools: string[], hcsTopicId: string, loggingClient: Client) {
    super();
    this.relevantTools = relevantTools;
    this.name = 'HCS Audit Trail Hook';
    this.description =
      'Hook to add audit trail to HCS messages. Available only in Agent Mode AUTONOMOUS. Applicable onl';
    this.hcsTopicId = hcsTopicId;
    this.loggingClient = loggingClient;
  }

  async postToolExecutionHook(
    context: Context,
    params: PostSecondaryActionParams,
    method: string,
  ): Promise<any> {
    if (!this.relevantTools.includes(method)) return;

    // HcsAuditTrailHook is available only in Agent Mode AUTONOMOUS.
    if (context.mode === AgentMode.RETURN_BYTES) {
      console.log(
        'Agent mode is RETURN_BYTES, stopping the agent execution. HcsAuditTrailHook is available only in Agent Mode AUTONOMOUS.',
      );
      throw new HookExecInterruptError(
        'Unsupported hook: HcsAuditTrailHook is available only in Agent Mode AUTONOMOUS. Stopping the agent execution.',
      );
    }

    // HcsAuditTrailHook requires the logging client to be provided.
    if (!this.loggingClient) return; // the audit trail hook is not supported if no client for handling the communication with HCS was provided. There is no entity that will pay for the transactions

    const logMessage: string = `Agent executed tool ${method} on with params ${JSON.stringify(params.normalisedParams)}.
    Transaction ID: ${(params.toolResult.raw as RawTransactionResponse).transactionId ?? 'N/A (query action)'}
    Transaction Status: ${(params.toolResult.raw as RawTransactionResponse).status ?? 'N/A (query action)'}
    Token ID: ${(params.toolResult.raw as RawTransactionResponse).tokenId ?? 'N/A'}
    Topic ID: ${(params.toolResult.raw as RawTransactionResponse).topicId ?? 'N/A '}
    Schedule ID: ${(params.toolResult.raw as RawTransactionResponse).scheduleId ?? 'N/A'}
    Account ID: ${(params.toolResult.raw as RawTransactionResponse).accountId ?? 'N/A'}
    `;
    await this.postMessageToHcsTopic(logMessage);
  }

  async postMessageToHcsTopic(message: string) {
    const topicId = this.hcsTopicId;
    if (!topicId) return;

    const tx = new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(message);

    const response = await tx.execute(this.loggingClient);

    const receipt = await response.getReceipt(this.loggingClient);

    if (receipt.status.toString() !== 'SUCCESS') {
      console.error(
        `HcsAuditTrailHook: Failed to submit message to HCS topic ${topicId}: ${receipt.status.toString()}`,
      );
      return;
    }
  }
}
