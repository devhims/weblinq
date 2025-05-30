import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

export function createDb(env: CloudflareBindings) {
  return drizzle(env.D1_DB, { schema });
}
