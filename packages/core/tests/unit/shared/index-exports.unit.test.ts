import { describe, expect, it } from 'vitest';

import { HederaAgentAPI, HederaAgentKit } from '@hashgraph/hedera-agent-kit';

describe('core package exports', () => {
  it('keeps HederaAgentKit as an alias of HederaAgentAPI', () => {
    expect(HederaAgentKit).toBe(HederaAgentAPI);
  });
});
