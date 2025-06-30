import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as durableHandlers from './web.durable-handlers';
import * as routes from './web.routes';

const router = createRouter();

// Apply requireAuth middleware to all web routes
// This ensures all web operations require authentication
router.use('/web', requireAuth);
router.use('/web/*', requireAuth);

// Mount all routes using Durable Object handlers
router.openapi(routes.screenshot, durableHandlers.screenshot);
router.openapi(routes.markdown, durableHandlers.markdown);
router.openapi(routes.jsonExtraction, durableHandlers.jsonExtraction);
router.openapi(routes.content, durableHandlers.content);
router.openapi(routes.scrape, durableHandlers.scrape);
router.openapi(routes.links, durableHandlers.links);
router.openapi(routes.search, durableHandlers.search);
router.openapi(routes.pdf, durableHandlers.pdf);

export default router;
