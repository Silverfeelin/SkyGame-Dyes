import { generateCodeVerifier, OAuth2Client, OAuth2Token } from '@badgateway/oauth2-client';

// Discord App Config
const CLIENT_ID = '1333861869626327176';
const REDIRECT_URI = `${location.origin}/auth`;
const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

const client = new OAuth2Client({
  clientId: CLIENT_ID,
  authorizationEndpoint: DISCORD_AUTH_URL,
  tokenEndpoint: DISCORD_TOKEN_URL,
});

// Login button click handler
export const discordAuthenticate = async () => {
    const codeVerifier = await generateCodeVerifier();
    localStorage.setItem('dsc-codeVerifier', codeVerifier);

    const uri = await client.authorizationCode.getAuthorizeUri({
      redirectUri: REDIRECT_URI,
      scope: ['identify'],
      codeVerifier
    });
    const url = new URL(uri);
    window.location.href = url.toString();
};

// After redirect, exchange the code for a token
export const discordHandleRedirect = async (code: string): Promise<void> => {
  const codeVerifier = localStorage.getItem('dsc-codeVerifier');
  if (!codeVerifier) {
    alert('Code verifier not found. Please restart the authentication process.');
    return;
  }

  const token = await client.authorizationCode.getToken({
    code,
    redirectUri: REDIRECT_URI,
    codeVerifier
  });

  const expiresAt = token.expiresAt;

  const response = await fetch('/api/auth', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.accessToken}`,
      'Expires-At': expiresAt ? `${expiresAt}` : ''
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }
}
