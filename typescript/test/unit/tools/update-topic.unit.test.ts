// tests/unit/update-topic-tool.unit.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, PrivateKey, PublicKey } from '@hashgraph/sdk';
import toolFactory, {
  UPDATE_TOPIC_TOOL,
} from '@/plugins/core-consensus-plugin/tools/consensus/update-topic';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import * as TxModeStrategy from '@/shared/strategies/tx-mode-strategy';
import { AccountResolver } from '@/shared';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';

// ---- CONSTANT TEST KEY ----
const TEST_PUBLIC_KEY = PublicKey.fromString(
  '302a300506032b6570032100aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
);

// ---- SHALLOW MOCKS ----
const mockedNormaliser = vi.mocked(HederaParameterNormaliser, { deep: false });
const mockedBuilder = vi.mocked(HederaBuilder, { deep: false });
const mockedTxStrategy = vi.mocked(TxModeStrategy, { deep: false });

// ---- Mocks for dependencies ----
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: { normaliseUpdateTopic: vi.fn((params: any) => ({ ...params })) },
}));

vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { updateTopic: vi.fn((_params: any) => ({ tx: 'updateTopicTx' })) },
}));

vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
    const raw = {
      status: 22,
      topicId: '0.0.4004',
      transactionId: '0.0.1234@1700000000.000000001',
    };
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
  }),
  RawTransactionResponse: {} as any,
}));

vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({
    getTopicInfo: vi.fn(async (_topicId: string) => ({
      admin_key: { key: TEST_PUBLIC_KEY.toStringRaw() },
      submit_key: { key: TEST_PUBLIC_KEY.toStringRaw() },
    })),
  })),
}));

vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getAnyAddressParameterDescription: vi.fn(() => 'topicId (string): Topic to update'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
  },
}));

vi.mock('@/shared', async () => {
  const actual = await vi.importActual('@/shared');
  return {
    ...actual,
    AccountResolver: {
      getDefaultPublicKey: vi.fn(async (_context: any, _client: any) => TEST_PUBLIC_KEY),
    },
  };
});

// ---- HELPERS ----
const makeClient = () => Client.forNetwork({});

// ---- TESTS ----
describe('update-topic tool (unit)', () => {
  const context: any = { accountId: '0.0.2002' };
  const params = {
    topicId: '0.0.4004',
    topicMemo: 'UpdatedTopic',
    submitKey: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(UPDATE_TOPIC_TOOL);
    expect(tool.name).toBe('Update Topic');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('update an existing Hedera Consensus Topic');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes happy path and returns formatted human message with tx id', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params as any);

    expect(res).toBeDefined();
    expect(res.raw).toBeDefined();
    expect(res.humanMessage).toMatch(/Topic successfully updated/);
    expect(res.humanMessage).toMatch(/Transaction ID:/);

    expect(mockedTxStrategy.handleTransaction).toHaveBeenCalledOnce();
    expect(mockedBuilder.updateTopic).toHaveBeenCalledOnce();
    expect(mockedNormaliser.normaliseUpdateTopic).toHaveBeenCalledWith(params, context, client);
  });

  it('returns error response object when an Error is thrown', async () => {
    mockedBuilder.updateTopic.mockImplementationOnce(() => {
      throw new Error('kaboom');
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params as any);
    expect(res.humanMessage).toContain('Failed to update topic');
    expect(res.humanMessage).toContain('kaboom');
    expect(res.raw.error).toContain('Failed to update topic');
  });

  it('returns generic failure response object when a non-Error is thrown', async () => {
    mockedBuilder.updateTopic.mockImplementationOnce(() => {
      throw 'string failure';
    });

    const tool = toolFactory(context);
    const client = makeClient();

    const res: any = await tool.execute(client, context, params as any);
    expect(res.humanMessage).toContain('Failed to update topic');
    expect(res.raw.error).toContain('Failed to update topic');
  });

  it('fails if the user public key does not match the topic admin key', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    // Mock AccountResolver to return a different key
    vi.mocked(AccountResolver.getDefaultPublicKey).mockResolvedValueOnce(
      PublicKey.fromString(
        '302a300506032b6570032100deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      ),
    );

    const res: any = await tool.execute(client, context, params as any);

    expect(res.humanMessage).toContain('You do not have permission');
    expect(res.raw.error).toContain('You do not have permission');
  });

  it('fails if trying to set submitKey when topic was created without one', async () => {
    const params = {
      topicId: '0.0.4004',
      topicMemo: 'UpdatedTopic',
      submitKey: PrivateKey.generateED25519().publicKey,
    };
    const tool = toolFactory(context);
    const client = makeClient();

    // Override the default mock just for this test
    vi.mocked(getMirrornodeService).mockReturnValueOnce({
      getTopicInfo: vi.fn(async () => ({
        admin_key: { key: TEST_PUBLIC_KEY.toStringRaw() },
      })),
    } as any);

    const res: any = await tool.execute(client, context, params as any);

    expect(res.humanMessage).toContain('Cannot update submitKey');
    expect(res.raw.error).toContain('Cannot update submitKey');
  });
});
