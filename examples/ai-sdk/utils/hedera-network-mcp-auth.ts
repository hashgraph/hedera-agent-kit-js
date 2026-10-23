import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

const CALLBACK_PORT = 8090;
const CALLBACK_URL = `http://127.0.0.1:${CALLBACK_PORT}/callback`;

/**
 * Minimal in-memory OAuth client provider for the hosted Hedera Network MCP.
 *
 * Client registration (dynamic), tokens and the PKCE verifier live only for the lifetime of the
 * process, so the wallet sign-in is repeated on every run. Persist them (file, keychain, DB) if
 * you want the session to survive restarts.
 */
export class InMemoryOAuthClientProvider implements OAuthClientProvider {
  private _clientInformation?: OAuthClientInformationMixed;
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;

  get redirectUrl(): string {
    return CALLBACK_URL;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'Hedera Agent Kit example',
      redirect_uris: [CALLBACK_URL],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  clientInformation() {
    return this._clientInformation;
  }

  saveClientInformation(info: OAuthClientInformationMixed) {
    this._clientInformation = info;
  }

  tokens() {
    return this._tokens;
  }

  saveTokens(tokens: OAuthTokens) {
    this._tokens = tokens;
  }

  saveCodeVerifier(codeVerifier: string) {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this._codeVerifier) throw new Error('No PKCE code verifier saved');
    return this._codeVerifier;
  }

  /** Opens the Hedera wallet sign-in page in the default browser. */
  redirectToAuthorization(authorizationUrl: URL) {
    console.log('\nOpen this URL to sign in with your Hedera wallet (WalletConnect):');
    console.log(authorizationUrl.toString(), '\n');
    const opener =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'start ""'
          : 'xdg-open';
    exec(`${opener} "${authorizationUrl.toString()}"`, () => {
      /* ignore: the URL was already printed for manual opening */
    });
  }
}

/**
 * Starts a local server that receives the OAuth redirect.
 * Call `waitForCode()` after the sign-in page was opened; it resolves with the authorization code.
 */
export function startOAuthCallbackServer(timeoutMs = 5 * 60 * 1000) {
  let resolveCode!: (code: string) => void;
  let rejectCode!: (err: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // Avoid an unhandled rejection if nobody awaits (e.g. the user is already signed in).
  codePromise.catch(() => {});

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', CALLBACK_URL);
    if (url.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    res.writeHead(code ? 200 : 400, { 'Content-Type': 'text/plain' });
    res.end(code ? 'Signed in. You can close this tab.' : `Sign-in failed: ${error ?? 'no code'}`);
    if (code) resolveCode(code);
    else
      rejectCode(new Error(`OAuth sign-in failed: ${error ?? 'no authorization code returned'}`));
  });
  server.listen(CALLBACK_PORT, '127.0.0.1');

  const timer = setTimeout(
    () => rejectCode(new Error('Timed out waiting for wallet sign-in')),
    timeoutMs,
  );

  return {
    waitForCode: () => codePromise,
    close: () => {
      clearTimeout(timer);
      server.close();
    },
  };
}
