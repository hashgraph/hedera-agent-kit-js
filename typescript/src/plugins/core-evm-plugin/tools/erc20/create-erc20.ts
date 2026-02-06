import { z } from 'zod';
import { AgentMode, type Context } from '@/shared/configuration';
import { BaseTool } from '@/shared/tools';
import { Client, Status, TransactionRecordQuery } from '@hashgraph/sdk';
import {
  ExecuteStrategyResult,
  handleTransaction,
  RawTransactionResponse,
} from '@/shared/strategies/tx-mode-strategy';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { getERC20FactoryAddress, ERC20_FACTORY_ABI } from '@/shared/constants/contracts';
import { transactionToolOutputParser } from '@/shared/utils/default-tool-output-parsing';

const createERC20Prompt = (context: Context = {}) => `
${PromptGenerator.getContextSnippet(context)}

This tool creates an ERC20 token on Hedera by calling the BaseERC20Factory contract. ERC20 is an EVM compatible fungible token.

Parameters:
- tokenName (str, required): The name of the token
- tokenSymbol (str, required): The symbol of the token
- decimals (int, optional): The number of decimals the token supports. Defaults to 18
- initialSupply (int, optional): The initial supply of the token. Defaults to 0
- ${PromptGenerator.getScheduledTransactionParamsDescription(context)}

${PromptGenerator.getParameterUsageInstructions()}
`;

const getERC20Address = async (client: Client, tx: RawTransactionResponse) => {
  const record = await new TransactionRecordQuery()
    .setTransactionId(tx.transactionId)
    .execute(client);
  return '0x' + record.contractFunctionResult?.getAddress(0);
};

const postProcess = (erc20Address?: string, response?: RawTransactionResponse) =>
  response?.scheduleId
    ? `Scheduled creation of ERC20 successfully.
Transaction ID: ${response.transactionId}
Schedule ID: ${response.scheduleId.toString()}`
    : `ERC20 token created successfully at address ${erc20Address ?? 'unknown'}`;

export const CREATE_ERC20_TOOL = 'create_erc20_tool';

export class CreateErc20Tool extends BaseTool {
  method = CREATE_ERC20_TOOL;
  name = 'Create ERC20 Token';
  description: string;
  parameters: z.ZodObject<any, any>;
  outputParser = transactionToolOutputParser;

  constructor(context: Context) {
    super();
    this.description = createERC20Prompt(context);
    this.parameters = createERC20Parameters(context);
  }

  async normalizeParams(
    params: z.infer<ReturnType<typeof createERC20Parameters>>,
    context: Context,
    client: Client,
  ) {
    const factoryAddress = getERC20FactoryAddress(client.ledgerId!);
    return await HederaParameterNormaliser.normaliseCreateERC20Params(
      params,
      factoryAddress,
      ERC20_FACTORY_ABI,
      'deployToken',
      context,
      client,
    );
  }

  async coreAction(normalisedParams: any, _context: Context, _client: Client) {
    return HederaBuilder.executeTransaction(normalisedParams);
  }

  async secondaryAction(transaction: any, client: Client, context: Context) {
    const result = await handleTransaction(transaction, client, context);

    if (context.mode === AgentMode.RETURN_BYTES) return result;

    const raw = (result as ExecuteStrategyResult).raw;
    const erc20Address = await getERC20Address(client, raw);
    const humanMessage = postProcess(erc20Address, raw);

    return { ...result, erc20Address, humanMessage };
  }

  async handleError(error: unknown, _context: Context): Promise<any> {
    const message =
      'Failed to create ERC20 token' + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[create_erc20_tool]', message);
    return {
      raw: { status: Status.InvalidTransaction, error: message },
      humanMessage: message,
    };
  }
}

const tool = (context: Context): BaseTool => new CreateErc20Tool(context);

export default tool;
