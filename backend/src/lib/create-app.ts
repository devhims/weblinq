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
  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.use(serveEmojiFavicon('🌐'));
  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.use(logger());

  // CORS middleware specifically for auth routes - now uses environment variables
  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.use('/api/auth/*', (c: any, next: any) => {
    const authCors = createAuthCors(c);
    return authCors(c, next);
  });

  // CORS middleware specifically for API key routes - essential for cookie transmission
  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.use('/api-keys/*', (c: any, next: any) => {
    const authCors = createAuthCors(c);
    return authCors(c, next);
  });

  // Auth instance creation for all routes
  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.use('*', (c: any, next: any) => {
    if (!c.get('auth')) {
      const auth = createAuth(c.env);
      c.set('auth', auth);
    }
    return next();
  });

  // Better Auth handler - now uses middleware-provided instance
  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.on(['POST', 'GET'], '/api/auth/*', (c: any) => {
    const auth = c.get('auth'); // Get from middleware
    return auth.handler(c.req.raw);
  });

  // Unified authentication middleware for all routes
  // Handles both session cookies and API keys automatically
  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.use('*', unifiedAuth);

  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.notFound(notFound);
  // @ts-ignore - Type issue with OpenAPIHono but functionality works
  app.onError(onError);
  return app;
}

export function createTestApp<R extends AppOpenAPI>(router: R) {
  return createApp().route('/', router);
}
