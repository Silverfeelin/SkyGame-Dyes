interface Env {
  DB: D1Database;
  DURABLE_SKY_DYE: DurableObjectNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const name = 'main';
  const id = context.env.DURABLE_SKY_DYE.idFromName(name);
  const stub = context.env.DURABLE_SKY_DYE.get(id);
  return await stub.fetch(context.request);
}
