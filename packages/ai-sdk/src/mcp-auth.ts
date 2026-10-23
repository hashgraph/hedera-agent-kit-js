import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import type { MCPServerOAuthOptions } from './mcp-configs';

/**
 * Runs the OAuth 2.1 authorization flow (dynamic client registration + PKCE) against an MCP
 * server before connecting, so the provided `authProvider` already holds valid tokens when the
 * MCP client connects.
 *
 * If the user has to sign in, `authProvider.redirectToAuthorization` is invoked (it should open
 * the sign-in page) and `waitForAuthorizationCode` is awaited for the resulting code.
 *
 * @param serverUrl - The MCP server URL
 * @param options - OAuth provider and authorization code callback
 */
export async function ensureMcpAuthorized(
  serverUrl: string,
  options: MCPServerOAuthOptions,
): Promise<void> {
  const { authProvider, waitForAuthorizationCode } = options;

  let result = await auth(authProvider, { serverUrl });
  if (result === 'REDIRECT') {
    const authorizationCode = await waitForAuthorizationCode();
    result = await auth(authProvider, { serverUrl, authorizationCode });
  }

  if (result !== 'AUTHORIZED') {
    throw new Error(`OAuth authorization failed for MCP server ${serverUrl}`);
  }
}
