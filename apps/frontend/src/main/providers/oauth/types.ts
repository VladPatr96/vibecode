export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  redirectUri: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Timestamp in milliseconds
  tokenType: string;
  scope?: string;
}

export interface OAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}
