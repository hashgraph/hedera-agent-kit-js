import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const getToolsMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const clientCtorMock = vi.hoisted(() => vi.fn());

vi.mock('@modelcontextprotocol/sdk/client/auth.js', () => ({ auth: authMock }));
vi.mock('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: class {
    constructor(config: unknown) {
      clientCtorMock(config);
    }
    getTools = getToolsMock;
  },
}));

import { ensureMcpAuthorized } from '../../src/mcp-auth';
import { loadMultipleMCPTools } from '../../src/hedera-mcps';
import { HederaMCPServer, type MCPServerOAuthOptions } from '../../src/mcp-configs';

const URL = 'https://agentic-testnet-mcp.hedera.com/mcp';

const makeOptions = (): MCPServerOAuthOptions => ({
  authProvider: {} as MCPServerOAuthOptions['authProvider'],
  waitForAuthorizationCode: vi.fn().mockResolvedValue('the-code'),
});

describe('ensureMcpAuthorized', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns without waiting when already authorized', async () => {
    authMock.mockResolvedValueOnce('AUTHORIZED');
    const options = makeOptions();

    await ensureMcpAuthorized(URL, options);

    expect(authMock).toHaveBeenCalledTimes(1);
    expect(options.waitForAuthorizationCode).not.toHaveBeenCalled();
  });

  it('waits for the authorization code after a redirect, then exchanges it', async () => {
    authMock.mockResolvedValueOnce('REDIRECT').mockResolvedValueOnce('AUTHORIZED');
    const options = makeOptions();

    await ensureMcpAuthorized(URL, options);

    expect(options.waitForAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(authMock).toHaveBeenLastCalledWith(options.authProvider, {
      serverUrl: URL,
      authorizationCode: 'the-code',
    });
  });

  it('throws when authorization does not complete', async () => {
    authMock.mockResolvedValue('REDIRECT');

    await expect(ensureMcpAuthorized(URL, makeOptions())).rejects.toThrow(
      /OAuth authorization failed/,
    );
  });
});

describe('loadMultipleMCPTools with the hosted Hedera Network MCP', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when no OAuth options are provided', async () => {
    await expect(
      loadMultipleMCPTools([HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET]),
    ).rejects.toThrow(/requires OAuth sign-in/);
  });

  it('authorizes and passes the authProvider to the MCP client', async () => {
    authMock.mockResolvedValueOnce('AUTHORIZED');
    const options = makeOptions();

    await loadMultipleMCPTools([HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET], {
      [HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET]: options,
    });

    const config = clientCtorMock.mock.calls[0][0];
    expect(config.mcpServers[HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET]).toMatchObject({
      type: 'http',
      url: URL,
      authProvider: options.authProvider,
    });
  });

  it('leaves non-OAuth servers untouched', async () => {
    await loadMultipleMCPTools([HederaMCPServer.HEDERION_MCP_MAINNET]);

    expect(authMock).not.toHaveBeenCalled();
    const config = clientCtorMock.mock.calls[0][0];
    expect(config.mcpServers[HederaMCPServer.HEDERION_MCP_MAINNET]).toEqual({
      type: 'http',
      url: 'https://hederion.com/mcp',
    });
  });
});
