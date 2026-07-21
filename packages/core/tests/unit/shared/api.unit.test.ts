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
  it('throws when client is undefined', () => {
    expect(() => new HederaAgentAPI(undefined as unknown as Client)).toThrow(
      'HederaAgentAPI requires a connected Client',
    );
  });

  it('throws when client has no ledgerId', () => {
    const disconnected = {} as unknown as Client;
    expect(() => new HederaAgentAPI(disconnected)).toThrow('Client must be connected to a network');
  });

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

  it('returns an empty array when no tools are registered', () => {
    const api = new HederaAgentAPI(client, {});

    expect(api.listTools()).toEqual([]);
  });
});
