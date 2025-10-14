import { z } from 'zod';
import { AgentMode, type Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, Status, TransactionRecordQuery } from '@hashgraph/sdk';
import {
  ExecuteStrategyResult,
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import { createERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getERC721FactoryAddress, ERC721_FACTORY_ABI } from '@/shared/constants/contracts';

const createERC721Prompt = (context: Context = {}) => `
${PromptGenerator.getContextSnippet(context)}

This tool creates an ERC721 token on Hedera by calling the BaseERC721Factory contract. ERC721 is an EVM compatible non fungible token (NFT).

Parameters:
- tokenName (str, required): The name of the token
- tokenSymbol (str, required): The symbol of the token
- baseURI (str, required): The base URI for token metadata
${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${PromptGenerator.getParameterUsageInstructions()}
The contractId returned by the tool is the address of the ERC721 Factory contract, the address of the ERC721 token is the erc721Address returned by the tool.
`;

const getERC721Address = async (client: Client, tx: RawTransactionResponse) => {
  const record = await new TransactionRecordQuery()
    .setTransactionId(tx.transactionId)
    .execute(client);
  return '0x' + record.contractFunctionResult?.getAddress(0);
};

const postProcess = (erc721Address?: string, response?: RawTransactionResponse) =>
  response?.scheduleId
    ? `Scheduled creation of ERC721 successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`
    : `ERC721 token created successfully at address ${erc721Address ?? 'unknown'}`;

const createERC721 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof createERC721Parameters>>,
) => {
  try {
    const factoryAddress = getERC721FactoryAddress(client.ledgerId!);
    const txParams = await HederaParameterNormaliser.normaliseCreateERC721Params(
      params,
      factoryAddress,
      ERC721_FACTORY_ABI,
      'deployToken',
      context,
      client,
    );

    const tx = HederaBuilder.executeTransaction(txParams);
    const result = await handleTransaction(tx, client, context);

    if (context.mode === AgentMode.RETURN_BYTES) return result;

    const raw = (result as ExecuteStrategyResult).raw;
    const erc721Address = await getERC721Address(client, raw);
    const humanMessage = postProcess(erc721Address, raw);

    return { ...result, erc721Address, humanMessage };
  } catch (error) {
    const message =
      'Failed to create ERC721 token' + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[create_erc721_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
};

export const CREATE_ERC721_TOOL = 'create_erc721_tool';

const tool = (context: Context): Tool => ({
  method: CREATE_ERC721_TOOL,
  name: 'Create ERC721 Token',
  description: createERC721Prompt(context),
  parameters: createERC721Parameters(context),
  execute: createERC721,
});

export default tool;
