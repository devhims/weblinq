import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// import webRoutes from './routes/web';
import webV2 from './routes/web/web-v2.index';

// Export Durable Objects
export { PlaywrightPoolDO } from './durable-objects/playwright-pool-do';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// V2 API routes - new PlaywrightPoolDO-based endpoints
const v2Routes = [webV2] as const;

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

v2Routes.forEach((route) => {
  app.route('/v2', route);
});

// Routes
// app.route('/api/web', webRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    service: 'weblinq-playwright-v2',
    description: 'Playwright-based web browser rendering API',
    version: '2.0.0',
    endpoints: {
      'POST /api/web/extract-markdown':
        'Extract markdown content from web pages',
      'POST /api/web/screenshot': 'Take screenshots of web pages',
      'GET /api/web/health': 'Health check endpoint',
    },
    documentation: 'https://weblinq.ai/docs',
  });
});

export default app;
