import { logger } from 'hono/logger';
import { notFound, onError, serveEmojiFavicon } from 'stoker/middlewares';
import { defaultHook } from 'stoker/openapi';

import type { AppBindings, AppOpenAPI } from './types';

import { OpenAPIHono } from '@hono/zod-openapi';

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

export default function createApp(): AppOpenAPI {
  const app = createRouter();

  // Basic middlewares
  app.use(serveEmojiFavicon('🔍'));
  app.use(logger());

  app.notFound(notFound);
  app.onError(onError);
  return app;
}

export function createTestApp(router: AppOpenAPI) {
  return createApp().route('/', router);
}
