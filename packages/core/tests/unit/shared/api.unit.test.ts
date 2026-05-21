import { describe, expect, it } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { z } from 'zod';

import HederaAgentAPI from '../../../src/shared/api';
import type { Tool } from '../../../src/shared/tools';

const client = Client.forTestnet();
const tool: Tool = {
  method: 'demo_tool',
  name: 'Demo Tool',
  description: 'A demo tool',
  parameters: z.object({}),
  execute: async () => ({ ok: true }),
};

describe('HederaAgentAPI', () => {
  it('lists registered tools without exposing executable handlers', () => {
    const api = new HederaAgentAPI(client, {}, [tool]);

    expect(api.listTools()).toEqual([
      {
        method: 'demo_tool',
        name: 'Demo Tool',
        description: 'A demo tool',
      },
    ]);
  });
});
