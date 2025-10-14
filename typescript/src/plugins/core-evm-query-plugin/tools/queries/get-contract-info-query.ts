import { z } from 'zod';
import { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { contractInfoQueryParameters } from '@/shared/parameter-schemas/evm.zod';
import { Client } from '@hashgraph/sdk';
import { Tool } from '@/shared/tools';
import { PromptGenerator } from '@/shared/utils/prompt-generator';
import { ContractInfo } from '@/shared/hedera-utils/mirrornode/types';

export const getContractInfoQueryPrompt = (context: Context = {}) => {
  const contextSnippet = PromptGenerator.getContextSnippet(context);
  const usageInstructions = PromptGenerator.getParameterUsageInstructions();

  return `
${contextSnippet}

This tool will return the information for a given Hedera contract.

Parameters:
- contractId (str): The contract ID to query for.
${usageInstructions}
`;
};

const postProcess = (contract: ContractInfo) => {
  const formatKey = (key?: { _type?: string; key?: string } | null) => {
    if (!key) return 'Not Set';
    return key._type ? key.key || 'Present' : 'Present';
  };

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return 'N/A';
    const [seconds, nanos] = ts.split('.');
    const date = new Date(Number(seconds) * 1000);
    return date.toISOString() + (nanos ? `.${nanos}` : '');
  };

  return `Here are the details for contract **${contract.contract_id || 'N/A'}**:

- **Memo**: ${contract.memo || 'N/A'}
- **Deleted**: ${contract.deleted ? 'Yes' : 'No'}
- **Permanent Removal**: ${contract.permanent_removal ? 'Yes' : 'No'}
- **Nonce**: ${contract.nonce ?? 'N/A'}

**Timestamps**:
- Created: ${formatTimestamp(contract.created_timestamp)}
- Expiration: ${formatTimestamp(contract.expiration_timestamp)}
- Valid From: ${contract.timestamp?.from || 'N/A'}
- Valid To: ${contract.timestamp?.to || 'N/A'}

**Entity IDs**:
- Auto Renew Account: ${contract.auto_renew_account || 'N/A'}
- File ID: ${contract.file_id || 'N/A'}
- Obtainer ID: ${contract.obtainer_id || 'N/A'}
- Proxy Account ID: ${contract.proxy_account_id || 'N/A'}

**Keys**:
- Admin Key: ${formatKey(contract.admin_key)}

**EVM**:
- Address: ${contract.evm_address || 'N/A'}
`;
};

export const getContractInfoQuery = async (
  client: Client,
  context: Context,
  params: z.infer<ReturnType<typeof contractInfoQueryParameters>>,
) => {
  try {
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);
    const contractInfo: ContractInfo = await mirrornodeService.getContractInfo(params.contractId);

    return {
      raw: { contractId: contractInfo.contract_id, contractInfo },
      humanMessage: postProcess(contractInfo),
    };
  } catch (error) {
    const desc = 'Failed to get contract info';
    const message = desc + (error instanceof Error ? `: ${error.message}` : '');
    console.error('[get_contract_info_query_tool]', message);
    return { raw: { error: message }, humanMessage: message };
  }
};

export const GET_CONTRACT_INFO_QUERY_TOOL = 'get_contract_info_query_tool';

const tool = (context: Context): Tool => ({
  method: GET_CONTRACT_INFO_QUERY_TOOL,
  name: 'Get Contract Info',
  description: getContractInfoQueryPrompt(context),
  parameters: contractInfoQueryParameters(context),
  execute: getContractInfoQuery,
});

export default tool;
