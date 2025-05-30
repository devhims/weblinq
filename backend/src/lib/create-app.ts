import { logger } from 'hono/logger';
import { notFound, onError, serveEmojiFavicon } from 'stoker/middlewares';
import { defaultHook } from 'stoker/openapi';

import { createAuth } from '@/lib/auth';
import { createAuthCors, unifiedAuth } from '@/middlewares';
import { OpenAPIHono } from '@hono/zod-openapi';

import type { AppBindings, AppOpenAPI } from './types';

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

export default function createApp() {
  const app = createRouter();

  // Basic middlewares
  app.use(serveEmojiFavicon('🌐'));
  app.use(logger());

  // CORS middleware specifically for auth routes - now uses environment variables
  app.use('/api/auth/*', (c, next) => {
    const authCors = createAuthCors(c);
    return authCors(c, next);
  });

  // Auth instance creation for all routes
  app.use('*', (c, next) => {
    if (!c.get('auth')) {
      const auth = createAuth(c.env);
      c.set('auth', auth);
    }
    return next();
  });

  // Better Auth handler - now uses middleware-provided instance
  app.on(['POST', 'GET'], '/api/auth/*', (c) => {
    const auth = c.get('auth'); // Get from middleware
    return auth.handler(c.req.raw);
  });

  // Unified authentication middleware for all routes
  // Handles both session cookies and API keys automatically
  app.use('*', unifiedAuth);

  app.notFound(notFound);
  app.onError(onError);
  return app;
}

export function createTestApp<R extends AppOpenAPI>(router: R) {
  return createApp().route('/', router);
}
