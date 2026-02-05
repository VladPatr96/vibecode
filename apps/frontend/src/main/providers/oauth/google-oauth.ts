import { OAuthConfig } from './types';
import { OAuthManager } from './oauth-manager';

export const GOOGLE_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/generative-language.retriever',
    'https://www.googleapis.com/auth/cloud-platform',
  ],
  redirectUri: 'http://localhost:19823/oauth/callback',
};

export function createGoogleOAuthManager(): OAuthManager {
  return new OAuthManager(GOOGLE_OAUTH_CONFIG);
}
