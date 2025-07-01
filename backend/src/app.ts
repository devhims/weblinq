import configureOpenAPI from '@/lib/configure-open-api';
import createApp from '@/lib/create-app';
import apiKeys from '@/routes/api-keys/api-keys.index';
import files from '@/routes/files/files.index';
import index from '@/routes/index.route';
import system from '@/routes/system/system.index';
import user from '@/routes/user/user.index';
import web from '@/routes/web/web.index';

const app = createApp();

configureOpenAPI(app);

// API versioning - all routes are mounted under /v1
const routes = [index, user, apiKeys, web, files, system] as const;

routes.forEach((route) => {
  app.route('/v1', route);
});

export type AppType = (typeof routes)[number];

// Export the Durable Object classes for Cloudflare Workers runtime
export { BrowserDO } from '@/browser/browser-do';
export { BrowserManagerDO } from '@/browser/browser-manager-do';
export { WebDurableObject } from '@/durable-objects/web-durable-object';

export default app;
