import { OAuthConfig } from './types';
import { OAuthManager } from './oauth-manager';

export const OPENAI_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.OPENAI_CLIENT_ID || '',
  authorizationEndpoint: 'https://auth.openai.com/authorize',
  tokenEndpoint: 'https://auth.openai.com/oauth/token',
  scopes: [
    'openid',
    'profile',
    'email',
    'model.request',
  ],
  redirectUri: 'http://localhost:19823/oauth/callback',
};

export function createOpenAIOAuthManager(): OAuthManager {
  return new OAuthManager(OPENAI_OAUTH_CONFIG);
}
