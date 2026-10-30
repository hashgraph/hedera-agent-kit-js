import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
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
 * Client registration (dynamic), tokens, the PKCE verifier and the OAuth `state` live only for the
 * lifetime of the process, so the wallet sign-in is repeated on every run. Persist them (file,
 * keychain, DB) if you want the session to survive restarts.
 */
export class InMemoryOAuthClientProvider implements OAuthClientProvider {
  private _clientInformation?: OAuthClientInformationMixed;
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;
  private _state?: string;

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

  /** Random OAuth `state` for the authorization request; the callback must echo it back (CSRF protection). */
  state(): string {
    this._state = randomBytes(32).toString('base64url');
    return this._state;
  }

  /** The `state` sent with the pending authorization request, if any. */
  get expectedState(): string | undefined {
    return this._state;
  }

  /** Opens the Hedera wallet sign-in page in the default browser. */
  redirectToAuthorization(authorizationUrl: URL) {
    const url = authorizationUrl.toString();
    console.log('\nOpen this URL to sign in with your Hedera wallet (WalletConnect):');
    console.log(url, '\n');
    if (authorizationUrl.protocol !== 'https:' && authorizationUrl.protocol !== 'http:') return;

    // No shell: the URL is passed as a single argument, so its contents are never interpreted.
    const [command, args] =
      process.platform === 'darwin'
        ? ['open', [url]]
        : process.platform === 'win32'
          ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
          : ['xdg-open', [url]];
    execFile(command, args, () => {
      /* ignore: the URL was already printed for manual opening */
    });
  }
}

/**
 * Starts a local server that receives the OAuth redirect.
 * Call `waitForCode()` after the sign-in page was opened; it resolves with the authorization code.
 * Callbacks whose `state` does not match `authProvider.expectedState` are rejected and ignored.
 */
export function startOAuthCallbackServer(
  authProvider: InMemoryOAuthClientProvider,
  timeoutMs = 5 * 60 * 1000,
) {
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
    const state = url.searchParams.get('state');
    if (!state || state !== authProvider.expectedState) {
      // Not from our pending sign-in: ignore it and keep waiting for the real callback.
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Invalid OAuth state');
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
  server.on('error', (err: NodeJS.ErrnoException) => {
    rejectCode(
      err.code === 'EADDRINUSE'
        ? new Error(
            `OAuth callback port ${CALLBACK_PORT} is already in use (is another example running?)`,
          )
        : err,
    );
  });
  server.listen(CALLBACK_PORT, '127.0.0.1');

  const timer = setTimeout(
    () => rejectCode(new Error('Timed out waiting for wallet sign-in')),
    timeoutMs,
  );
  codePromise.finally(() => clearTimeout(timer)).catch(() => {});

  return {
    waitForCode: () => codePromise,
    close: () => {
      clearTimeout(timer);
      server.close();
    },
  };
}
