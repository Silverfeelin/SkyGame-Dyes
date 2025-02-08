import { discordGetUserIdAsync, getCookieAuth, invalidRequest } from './util';

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authHeader = getCookieAuth(context.request);
  if (!authHeader) { return invalidRequest('Authorization cookie missing.'); }

  const [userId, username] = await discordGetUserIdAsync(authHeader);
  if (!userId) { return invalidRequest('Authorization cookie invalid.'); }

  const queryExport = `
    INSERT INTO exports (userId, username)
    VALUES (?, ?)
  `;

  await context.env.DB.prepare(queryExport).bind(userId, username).run();

  const queryGet = `
    SELECT * FROM markers
  `;
  const markers = await context.env.DB.prepare(queryGet).all();
  const columns = ['id', 'createdOn', 'userId', 'username', 'epoch', 'lat', 'lng', 'size'];
  const data = {
    columns,
    markers: markers.results.map((marker) => [
      marker['id'],
      marker['createdOn'],
      marker['userId'],
      marker['username'],
      marker['epoch'],
      marker['lat'],
      marker['lng'],
      marker['size'],
    ])
  };

  const response = new Response(JSON.stringify(data), { status: 200 });
  return response;
}
