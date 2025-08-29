import { z } from 'zod';
import { AgentMode, type Context } from '@/shared/configuration';
import type { Tool } from '@/shared/tools';
import { Client, TransactionRecordQuery } from '@hashgraph/sdk';
import { ExecuteStrategyResult, handleTransaction } from '@/shared/strategies/tx-mode-strategy';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getERC20FactoryAddress, ERC20_FACTORY_ABI } from '@/shared/constants/contracts';

const createERC20Prompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool creates an ERC20 token on Hedera by calling the BaseERC20Factory contract.

Parameters:
- tokenName (str, required): The name of the token
- tokenSymbol (str, required): The symbol of the token
- decimals (int, optional): The number of decimals the token supports. Defaults to 18
- initialSupply (int, optional): The initial supply of the token. Defaults to 0
${usageInstructions}
`;
};

const getERC20Address = async (client: Client, executeStrategyResult: ExecuteStrategyResult) => {
  const record = await new TransactionRecordQuery()
    .setTransactionId(executeStrategyResult.raw.transactionId)
    .execute(client);
  return '0x' + record.contractFunctionResult?.getAddress(0);
};

const createERC20 = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof createERC20Parameters>>,
) => {
  try {
    const factoryContractAddress = getERC20FactoryAddress(client.ledgerId!);
    const normalisedParams = HederaParameterNormaliser.normaliseCreateERC20Params(
      params,
      factoryContractAddress,
      ERC20_FACTORY_ABI,
      'deployToken',
    );
    const tx = HederaBuilder.executeTransaction(normalisedParams);
    const result = await handleTransaction(tx, client, context);
    if (context.mode == AgentMode.AUTONOMOUS) {
      const erc20Address = await getERC20Address(client, result as ExecuteStrategyResult);
      return {
        ...(result as ExecuteStrategyResult),
        erc20Address: erc20Address?.toString(),
        message: `ERC20 token created successfully at address ${erc20Address?.toString()}`,
      };
    }
    return result;
  } catch (error) {
    console.error('[CreateERC20] Error creating ERC20 token:', error);
    if (error instanceof Error) {
      return error.message;
    }
    return 'Failed to create ERC20 token';
  }
};

export const CREATE_ERC20_TOOL = 'create_erc20_tool';

const tool = (context: Context): Tool => ({
  method: CREATE_ERC20_TOOL,
  name: 'Create ERC20 Token',
  description: createERC20Prompt(context),
  parameters: createERC20Parameters(context),
  execute: createERC20,
});

export default tool;
