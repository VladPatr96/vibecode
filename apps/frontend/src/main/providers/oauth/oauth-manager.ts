import { BrowserWindow } from 'electron';
import * as crypto from 'crypto';
import { OAuthConfig, OAuthState, OAuthTokens } from './types';

export class OAuthManager {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Starts the OAuth Authorization Code flow with PKCE
   */
  async startAuthFlow(): Promise<OAuthTokens> {
    const state = this.generateState();
    const authUrl = this.buildAuthUrl(state);

    try {
      const authCode = await this.openAuthWindow(authUrl, state);
      return await this.exchangeCodeForTokens(authCode, state.codeVerifier);
    } catch (error) {
      console.error('OAuth flow failed:', error);
      throw error;
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    return this.parseTokenResponse(data);
  }

  private generateState(): OAuthState {
    const state = this.base64UrlEncode(crypto.randomBytes(32));
    const codeVerifier = this.base64UrlEncode(crypto.randomBytes(32));

    return {
      state,
      codeVerifier,
      redirectUri: this.config.redirectUri,
      createdAt: Date.now(),
    };
  }

  private buildAuthUrl(state: OAuthState): string {
    const codeChallenge = this.generateCodeChallenge(state.codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state: state.state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${this.config.authorizationEndpoint}?${params.toString()}`;
  }

  private generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return this.base64UrlEncode(hash);
  }

  private base64UrlEncode(buffer: Buffer): string {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private openAuthWindow(url: string, state: OAuthState): Promise<string> {
    return new Promise((resolve, reject) => {
      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
        show: true,
        alwaysOnTop: true,
      });

      const cleanup = () => {
        if (!authWindow.isDestroyed()) {
          authWindow.close();
        }
      };

      let authCode: string | null = null;

      const handleUrl = (currentUrl: string) => {
        if (currentUrl.startsWith(this.config.redirectUri)) {
          const urlObj = new URL(currentUrl);
          const urlState = urlObj.searchParams.get('state');
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (error) {
            cleanup();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (urlState !== state.state) {
            cleanup();
            reject(new Error('Invalid state parameter received'));
            return;
          }

          if (code) {
            authCode = code;
            cleanup();
            resolve(code);
          }
        }
      };

      authWindow.webContents.on('will-redirect', (event, newUrl) => {
        handleUrl(newUrl);
      });

      authWindow.webContents.on('will-navigate', (event, newUrl) => {
        handleUrl(newUrl);
      });

      authWindow.on('closed', () => {
        if (!authCode) {
          reject(new Error('Authentication cancelled by user'));
        }
      });

      authWindow.loadURL(url).catch(err => {
        reject(new Error(`Failed to load auth URL: ${err.message}`));
      });
    });
  }

  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: codeVerifier,
    });

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    return this.parseTokenResponse(data);
  }

  private parseTokenResponse(data: any): OAuthTokens {
    if (!data.access_token) {
      throw new Error('Invalid token response: missing access_token');
    }

    // Default expiration to 1 hour if not provided
    const expiresIn = data.expires_in ? parseInt(data.expires_in, 10) : 3600;
    const expiresAt = Date.now() + (expiresIn * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }
}
