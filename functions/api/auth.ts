interface Env {
  DB: D1Database;
  DYE_TRUSTED_CSV: string;
}

const invalidRequest = (msg: string) => new Response(`Invalid request. ${msg}`, { status: 400 });
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accessToken = context.request.headers.get('Authorization');
  if (!accessToken) { return invalidRequest('Authorization header missing.'); }

  const expiresAt = context.request.headers.get('Expires-At');
  if (!expiresAt) { return invalidRequest('Expires-At header missing.'); }

  const [userId, username] = await getUserIdAsync(accessToken);
  if (!userId) { return invalidRequest('Authorization header invalid.'); }

  const response = new Response('', { status: 201 });
  const cookieFlags = 'HttpOnly; Secure; Path=/; SameSite=Strict;';
  const cookieExpires = new Date(parseInt(expiresAt) - 5 * 60000).toUTCString();

  response.headers.append('Set-Cookie', `Authorization=${accessToken}; Expires=${cookieExpires}; ${cookieFlags}`);
  response.headers.append('Set-Cookie', `AuthorizationType=Discord; Expires=${cookieExpires}; ${cookieFlags}`);
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

/**
 * Fetches the user ID using the provided Discord Authorization header.
 * This call happens server-side to prevent client-side control over which user ID is used.
 */
async function getUserIdAsync(accessToken: string): Promise<[string, string]> {
  const userResponse = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `${accessToken}` },
  });

  const userData = await userResponse.json() as any;
  const id = (userData?.id) || '';
  const username = (userData?.username) || '';
  return id && username ? [id, username] : [undefined, undefined];
}
