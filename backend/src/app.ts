import configureOpenAPI from '@/lib/configure-open-api';
import createApp from '@/lib/create-app';
import apiKeys from '@/routes/api-keys/api-keys.index';
import files from '@/routes/files/files.index';
import index from '@/routes/index.route';
import system from '@/routes/system/system.index';
import user from '@/routes/user/user.index';
import web2 from '@/routes/web-2/web-2.index';
import web from '@/routes/web/web.index';

const app = createApp();

configureOpenAPI(app);

// API versioning - routes are mounted under /v1 and /v2
const v1Routes = [index, user, apiKeys, web, files, system] as const;
const v2Routes = [web2] as const;

v1Routes.forEach((route) => {
  app.route('/v1', route);
});

v2Routes.forEach((route) => {
  app.route('/v2', route);
});

export type AppType = (typeof v1Routes)[number] | (typeof v2Routes)[number];

// Export the Durable Object classes for Cloudflare Workers runtime
export { BrowserDO } from '@/durable-objects/browser/browser-do';
export { BrowserManagerDO } from '@/durable-objects/browser/browser-manager-do';
export { WebDurableObject } from '@/durable-objects/user-do';
export default app;
