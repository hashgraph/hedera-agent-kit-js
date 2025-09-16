import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  GET_CONTRACT_INFO_QUERY_TOOL,
} from '@/plugins/core-evm-query-plugin/tools/queries/get-contract-info-query';

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide contractId as JSON.'),
  },
}));

const mockGetContractInfo = vi.fn();
vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({
    getContractInfo: mockGetContractInfo,
  })),
}));

// --- Test Setup ---
const makeClient = () => Client.forNetwork({});
const context: any = {
  mirrornodeService: 'https://mirror.testnet.hedera.com',
  ledgerId: 'testnet',
};

describe('get-contract-info tool (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);

    expect(tool.method).toBe(GET_CONTRACT_INFO_QUERY_TOOL);
    expect(tool.name).toBe('Get Contract Info');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain(
      'This tool will return the information for a given Hedera contract',
    );
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted contract info', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const contractInfo = {
      contract_id: '0.0.5005',
      memo: 'test contract',
      deleted: false,
      permanent_removal: false,
      nonce: 1,
      created_timestamp: '1700000000.000000001',
      expiration_timestamp: '1800000000.000000001',
      timestamp: { from: '1700000000.000000001', to: null },
      auto_renew_account: '0.0.1001',
      file_id: '0.0.2002',
      obtainer_id: null,
      proxy_account_id: null,
      admin_key: { _type: 'ED25519', key: 'abcd' },
      evm_address: '0x1234567890abcdef',
    };

    mockGetContractInfo.mockResolvedValueOnce(contractInfo);

    const res: any = await tool.execute(client, context, { contractId: '0.0.5005' });

    expect(res.raw).toEqual({ contractId: '0.0.5005', contractInfo });
    expect(res.humanMessage).toContain('Here are the details for contract **0.0.5005**:');
    expect(res.humanMessage).toContain('Memo');
    expect(mockGetContractInfo).toHaveBeenCalledWith('0.0.5005');
  });

  it('returns error message when an Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    mockGetContractInfo.mockRejectedValueOnce(new Error('boom'));

    const res: any = await tool.execute(client, context, { contractId: '0.0.9999' });

    expect(res.raw.error).toContain('boom');
    expect(res.humanMessage).toContain('boom');
  });

  it('returns generic failure message when a non-Error is thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    mockGetContractInfo.mockRejectedValueOnce('string error');

    const res: any = await tool.execute(client, context, { contractId: '0.0.8888' });

    expect(res.humanMessage).toContain('Failed to get contract info');
    expect(res.raw.error).toContain('Failed to get contract info');
  });
});
