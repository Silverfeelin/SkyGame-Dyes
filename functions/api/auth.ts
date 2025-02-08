import { discordGetUserIdAsync, invalidRequest } from './util';

interface Env {
  DB: D1Database;
  DYE_TRUSTED_CSV: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accessToken = context.request.headers.get('Authorization');
  if (!accessToken) { return invalidRequest('Authorization header missing.'); }

  const expiresAt = context.request.headers.get('Expires-At');
  if (!expiresAt) { return invalidRequest('Expires-At header missing.'); }

  const [userId, username] = await discordGetUserIdAsync(accessToken);
  if (!userId) { return invalidRequest('Authorization header invalid.'); }

  const response = new Response('', { status: 201 });
  const cookieFlags = 'HttpOnly; Path=/; SameSite=Strict;';
  const cookieSecure = context.request.url.startsWith('http://localhost') ? '' : 'Secure;';
  const cookieExpires = new Date(parseInt(expiresAt) - 5 * 60000).toUTCString();

  response.headers.append('Set-Cookie', `Authorization=${accessToken}; Expires=${cookieExpires}; ${cookieFlags} ${cookieSecure}`);
  response.headers.append('Set-Cookie', `AuthorizationType=Discord; Expires=${cookieExpires}; ${cookieFlags} ${cookieSecure}`);
  response.headers.append('Set-Cookie', `AuthorizationName=${encodeURIComponent(username)}; Expires=${cookieExpires}; Path=/;`);

  return response;
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const response = new Response('', { status: 201 });
  const cookieFlags = 'HttpOnly; Secure; Path=/; SameSite=Strict;';
  const cookieExpires = new Date(0).toUTCString();

  response.headers.append('Set-Cookie', `Authorization=; Expires=${cookieExpires}; ${cookieFlags}`);
  response.headers.append('Set-Cookie', `AuthorizationType=; Expires=${cookieExpires}; ${cookieFlags}`);
  response.headers.append('Set-Cookie', `AuthorizationName=; Expires=${cookieExpires}; Path=/;`);

  return response;
}
