export const DISCORD_USER_URL = 'https://discord.com/api/users/@me';

/** Gets the auth header from the request cookies. */
export function getCookieAuth(request: Request<unknown>): string | undefined {
		// Check Authorization.
		const cookies = request.headers.get('Cookie');
    let authHeader = cookies?.split(';').find(cookie => cookie.startsWith('Authorization='))?.split('=')[1];
		if (authHeader) { authHeader = decodeURIComponent(authHeader); }
    return authHeader || undefined;
}

/**
 * Fetches the user ID using the provided Discord Authorization header.
 * This call happens server-side to prevent client-side control over which user ID is used.
 */
export async function discordGetUserIdAsync(accessToken: string): Promise<[string, string]> {
  const userResponse = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `${accessToken}` },
  });

  const userData = await userResponse.json() as any;
  const id = (userData?.id) || '';
  const username = (userData?.username) || '';
  return id && username ? [id, username] : [undefined, undefined];
}

/** Returns an invalid request response. */
export function invalidRequest(msg: string): Response {
  return new Response(`Invalid request. ${msg}`, { status: 400 });
}
