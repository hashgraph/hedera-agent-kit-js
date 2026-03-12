import { describe, it, expect } from 'vitest';
import { MaxRecipientsPolicy, Context, AgentMode } from '@/shared';
import { Client, Hbar } from '@hashgraph/sdk';
import { coreAccountPluginToolNames } from '@/plugins/core-account-plugin';
import { coreTokenPluginToolNames } from '@/plugins/core-token-plugin';

describe('MaxRecipientsPolicy Unit Tests', () => {
  const context: Context = { mode: AgentMode.AUTONOMOUS };
  const client = {} as Client;

  describe('HBAR transfers (hbarTransfers)', () => {
    it('should block if positive-amount hbar recipients exceed maxRecipients', () => {
      const policy = new MaxRecipientsPolicy(1);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          hbarTransfers: [
            { accountId: '0.0.100', amount: -2 }, // sender (negative)
            { accountId: '0.0.1', amount: 1 },
            { accountId: '0.0.2', amount: 1 },
          ],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](
          context,
          params,
          client,
          coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,
        ),
      ).toBe(true);
    });

    it('should not block if positive-amount hbar recipients are within maxRecipients', () => {
      const policy = new MaxRecipientsPolicy(2);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          hbarTransfers: [
            { accountId: '0.0.100', amount: -2 }, // sender (negative)
            { accountId: '0.0.1', amount: 1 },
            { accountId: '0.0.2', amount: 1 },
          ],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](
          context,
          params,
          client,
          coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,
        ),
      ).toBe(false);
    });
  });

  describe('HBAR transfers with SDK objects (Hbar/Long amounts)', () => {
    // Simulates Hbar/Long objects that have isNegative() and isZero() methods

    it('should block if positive Hbar-object recipients exceed maxRecipients', () => {
      const policy = new MaxRecipientsPolicy(1);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          hbarTransfers: [
            { accountId: '0.0.100', amount: Hbar.fromTinybars(-2) }, // sender
            { accountId: '0.0.1', amount: Hbar.fromTinybars(1) },
            { accountId: '0.0.2', amount: Hbar.fromTinybars(1) },
          ],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](
          context,
          params,
          client,
          coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,
        ),
      ).toBe(true);
    });

    it('should not count zero-amount entries as recipients', () => {
      const policy = new MaxRecipientsPolicy(1);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          hbarTransfers: [
            { accountId: '0.0.100', amount: Hbar.fromTinybars(-1) }, // sender
            { accountId: '0.0.1', amount: Hbar.fromTinybars(1) }, // recipient
            { accountId: '0.0.2', amount: Hbar.fromTinybars(0) }, // zero — not a recipient
          ],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](
          context,
          params,
          client,
          coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,
        ),
      ).toBe(false);
    });
  });

  describe('Fungible token transfers (tokenTransfers)', () => {
    it('should block if positive-amount token recipients exceed maxRecipients in airdrop', () => {
      const policy = new MaxRecipientsPolicy(1);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          tokenTransfers: [
            { tokenId: '0.0.999', accountId: '0.0.100', amount: -50 }, // sender
            { tokenId: '0.0.999', accountId: '0.0.1', amount: 25 },
            { tokenId: '0.0.999', accountId: '0.0.2', amount: 25 },
          ],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](
          context,
          params,
          client,
          coreTokenPluginToolNames.AIRDROP_FUNGIBLE_TOKEN_TOOL,
        ),
      ).toBe(true);
    });

    it('should not block if positive-amount token recipients are within maxRecipients', () => {
      const policy = new MaxRecipientsPolicy(2);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          tokenTransfers: [
            { tokenId: '0.0.999', accountId: '0.0.100', amount: -50 }, // sender
            { tokenId: '0.0.999', accountId: '0.0.1', amount: 25 },
            { tokenId: '0.0.999', accountId: '0.0.2', amount: 25 },
          ],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](
          context,
          params,
          client,
          coreTokenPluginToolNames.AIRDROP_FUNGIBLE_TOKEN_TOOL,
        ),
      ).toBe(false);
    });
  });

  describe('NFT transfers (transfers)', () => {
    it('should block if NFT recipients exceed maxRecipients', () => {
      const policy = new MaxRecipientsPolicy(1);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          transfers: [
            { nftId: 'nft-1', receiver: '0.0.1' },
            { nftId: 'nft-2', receiver: '0.0.2' },
          ],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](
          context,
          params,
          client,
          coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
        ),
      ).toBe(true);
    });

    it('should not block if NFT recipients are within maxRecipients', () => {
      const policy = new MaxRecipientsPolicy(2);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          transfers: [
            { nftId: 'nft-1', receiver: '0.0.1' },
            { nftId: 'nft-2', receiver: '0.0.2' },
          ],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](
          context,
          params,
          client,
          coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
        ),
      ).toBe(false);
    });
  });

  describe('Custom Strategies', () => {
    it('should use custom strategy when provided', () => {
      const customStrategy = (params: any) => params.customRecipients.length;
      const policy = new MaxRecipientsPolicy(1, ['my_custom_tool'], {
        my_custom_tool: customStrategy,
      });

      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {
          customRecipients: ['0.0.1', '0.0.2'],
        },
      };

      expect(
        policy['shouldBlockPostParamsNormalization'](context, params, client, 'my_custom_tool'),
      ).toBe(true);
    });

    it('should block if tool is unhandled and no custom strategy is provided', () => {
      const policy = new MaxRecipientsPolicy(1);
      const params = {
        context,
        client,
        rawParams: {},
        normalisedParams: {},
      };

      expect(() =>
        policy['shouldBlockPostParamsNormalization'](
          context,
          params as any,
          client,
          'unknown_tool',
        ),
      ).toThrowError(/MaxRecipientsPolicy: unhandled tool 'unknown_tool'/i);
    });
  });

  it('should include additional tools from constructor', () => {
    const policy = new MaxRecipientsPolicy(1, ['customTool'], { customTool: () => 0 });
    expect(policy.relevantTools).toContain('customTool');
    expect(policy.relevantTools).toContain(coreAccountPluginToolNames.TRANSFER_HBAR_TOOL);
  });
});
