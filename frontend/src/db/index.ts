import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema'; // your table defs

const proxyUrl = process.env.D1_PROXY_URL!; // export this in .env
const proxyKey = process.env.D1_PROXY_KEY!; // same string as API_KEY

const driver = async (
  sql: string,
  params: unknown[],
  method: 'all' | 'get' | 'run' | 'values'
) => {
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${proxyKey}`,
    },
    body: JSON.stringify({ sql, params, method }),
  });
  if (!res.ok) throw new Error(await res.text());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<{ rows: any[][] }>;
};

export const db = drizzle(driver, { schema });
