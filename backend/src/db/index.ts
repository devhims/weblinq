import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

export function createDb(env: CloudflareBindings, bookmark?: string) {
  // Use D1 Sessions API for read replication and performance
  // https://developers.cloudflare.com/d1/best-practices/read-replication/

  let d1Session;
  let startingConstraint: string;

  if (bookmark && bookmark !== 'first-unconstrained') {
    // Start session from previous bookmark for sequential consistency
    console.log(`📖 [D1-SESSION] Starting session with bookmark: ${bookmark.substring(0, 16)}...`);
    d1Session = env.D1_DB.withSession(bookmark);
    startingConstraint = bookmark;
  } else {
    // Start with primary for lowest cold-start latency and freshest data
    console.log(`📖 [D1-SESSION] Starting primary session (freshest data, avoids cold replica fallback)`);
    d1Session = env.D1_DB.withSession('first-primary');
    startingConstraint = 'first-primary';
  }

  // Create Drizzle database instance with the session
  // D1DatabaseSession has prepare/batch methods compatible with Drizzle
  const db = drizzle(d1Session as any, { schema });

  // Extend db object with session management methods
  return Object.assign(db, {
    getBookmark: () => {
      const bookmark = d1Session.getBookmark();
      if (bookmark) {
        console.log(`🔖 [D1-SESSION] Generated bookmark: ${bookmark.substring(0, 16)}...`);
      }
      return bookmark;
    },
    getStartingConstraint: () => startingConstraint,
    getRawSession: () => d1Session,
    // Add observability for D1 Sessions API
    logReplicationInfo: async () => {
      try {
        // Execute multiple simple queries to test different scenarios
        const queries = [
          'SELECT 1 as test_unconstrained',
          'SELECT COUNT(*) as table_count FROM sqlite_master WHERE type="table"',
          'SELECT datetime("now") as current_time',
        ];

        const results = [];
        for (const query of queries) {
          const result = await d1Session.prepare(query).run();
          if (result.meta) {
            const served_by_region = result.meta.served_by_region;
            const served_by_primary = result.meta.served_by_primary;
            console.log(
              `🌍 [D1-REPLICATION] Query "${query}" served by region: ${served_by_region || 'unknown'}, primary: ${
                served_by_primary ?? 'unknown'
              }`,
            );
            results.push({ query, served_by_region, served_by_primary });
          }
        }
        return results;
      } catch (error) {
        console.warn(`⚠️ [D1-REPLICATION] Failed to get replication info:`, error);
      }
      return null;
    },
  });
}

export type DbWithSession = ReturnType<typeof createDb>;
