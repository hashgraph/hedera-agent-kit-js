import { z } from 'zod';
import { AgentMode, type Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, TransactionRecordQuery } from '@hashgraph/sdk';
import { ExecuteStrategyResult, handleTransaction } from '@/shared/strategies/tx-mode-strategy';
import { createERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getERC721FactoryAddress, ERC721_FACTORY_ABI } from '@/shared/constants/contracts';

const createERC721Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool creates an ERC721 token on Hedera by calling the BaseERC721Factory contract.

Parameters:
- tokenName (str, required): The name of the token
- tokenSymbol (str, required): The symbol of the token
- baseURI (str, required): The base URI for token metadata.
${usageInstructions}

The contractId returned by the tool is the address of the ERC721 Factory contract, the address of the ERC721 token is the erc721Address returned by the tool.
`;
};

const getERC721Address = async (client: Client, executeStrategyResult: ExecuteStrategyResult) => {
  const record = await new TransactionRecordQuery()
    .setTransactionId(executeStrategyResult.raw.transactionId)
    .execute(client);
  return '0x' + record.contractFunctionResult?.getAddress(0);
};

const createERC721 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof createERC721Parameters>>,
) => {
  try {
    const factoryContractAddress = getERC721FactoryAddress(client.ledgerId!);
    const normalisedParams = HederaParameterNormaliser.normaliseCreateERC721Params(
      params,
      factoryContractAddress,
      ERC721_FACTORY_ABI,
      'deployToken',
    );
    const tx = HederaBuilder.executeTransaction(normalisedParams);
    const result = await handleTransaction(tx, client, context);

    if (context.mode == AgentMode.AUTONOMOUS) {
      const erc721Address = await getERC721Address(client, result as ExecuteStrategyResult);
      return {
        ...result,
        erc721Address: erc721Address?.toString(),
        message: `ERC721 token created successfully at address ${erc721Address?.toString()}`,
      };
    }
    return result;
  } catch (error) {
    console.error('[CreateERC721] Error creating ERC721 token:', error);
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to create ERC721 token';
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
