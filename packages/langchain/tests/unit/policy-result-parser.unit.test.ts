import { describe, it, expect } from 'vitest';
import ResponseParserService from '../../src/responseParserService';

// Minimal stub for ToolMessage compatible with the is-tool-message guard:
// { type: 'tool', tool_call_id, name, id, content }
function makeToolMessage(name: string, content: string): any {
  return {
    type: 'tool',
    tool_call_id: `call_${name}`,
    name,
    id: `msg_${name}_${Math.random()}`,
    content,
  };
}

const policyBlockEnvelope = {
  raw: {
    status: 'ERROR',
    errorCode: 'POLICY_BLOCKED',
    error: 'Failed to execute Transfer HBAR: Action transfer_hbar blocked by policy: Max Recipients Policy',
    policyBlock: {
      code: 'POLICY_BLOCKED',
      policyName: 'Max Recipients Policy',
      toolMethod: 'transfer_hbar',
      stage: 'post_params_normalization',
      details: { recipientCount: 3, maxRecipients: 1 },
    },
  },
  humanMessage: 'Failed to execute Transfer HBAR: Action transfer_hbar blocked by policy: Max Recipients Policy',
};

const successEnvelope = {
  raw: { status: 'SUCCESS', transactionId: '0.0.1@1.2' },
  humanMessage: 'Done',
};

// Build a mock toolkit list with a parser for 'transfer_hbar'
function buildTools(): any[] {
  return [
    {
      name: 'transfer_hbar',
      responseParsingFunction: (content: string) => JSON.parse(content),
    },
    {
      name: 'get_balance',
      responseParsingFunction: (content: string) => JSON.parse(content),
    },
  ];
}

describe('ResponseParserService – parsePolicyBlocks / hasPolicyBlocks (LangChain)', () => {
  it('parsePolicyBlocks returns only policy-block entries', () => {
    const service = new ResponseParserService(buildTools());
    const response = {
      messages: [
        makeToolMessage('transfer_hbar', JSON.stringify(policyBlockEnvelope)),
        makeToolMessage('get_balance', JSON.stringify(successEnvelope)),
      ],
    };

    const blocks = service.parsePolicyBlocks(response);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('policy_block');
    expect(blocks[0].policyName).toBe('Max Recipients Policy');
    expect(blocks[0].details).toEqual({ recipientCount: 3, maxRecipients: 1 });
  });

  it('parsePolicyBlocks returns empty array when no policy blocks', () => {
    const service = new ResponseParserService(buildTools());
    const response = {
      messages: [makeToolMessage('get_balance', JSON.stringify(successEnvelope))],
    };
    expect(service.parsePolicyBlocks(response)).toHaveLength(0);
  });

  it('hasPolicyBlocks returns true when a policy block is present', () => {
    const service = new ResponseParserService(buildTools());
    const response = {
      messages: [
        makeToolMessage('transfer_hbar', JSON.stringify(policyBlockEnvelope)),
      ],
    };
    expect(service.hasPolicyBlocks(response)).toBe(true);
  });

  it('hasPolicyBlocks returns false when no policy blocks', () => {
    const service = new ResponseParserService(buildTools());
    const response = {
      messages: [makeToolMessage('get_balance', JSON.stringify(successEnvelope))],
    };
    expect(service.hasPolicyBlocks(response)).toBe(false);
  });

  it('parsePolicyBlocks deduplicates: same message id is not counted twice', () => {
    const service = new ResponseParserService(buildTools());
    const msg = makeToolMessage('transfer_hbar', JSON.stringify(policyBlockEnvelope));
    // Same object twice (same `id`) — should be processed only once
    const response = { messages: [msg, msg] };
    const blocks = service.parsePolicyBlocks(response);
    expect(blocks).toHaveLength(1);
  });
});
