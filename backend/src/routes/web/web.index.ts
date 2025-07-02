import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './web.handlers';
import * as routes from './web.routes';

const router = createRouter();

// Apply requireAuth middleware to all web routes
// This ensures all web operations require authentication
router.use('/web', requireAuth);
router.use('/web/*', requireAuth);

// Mount all routes using Durable Object handlers
router.openapi(routes.screenshot, handlers.screenshot);
router.openapi(routes.markdown, handlers.markdown);
router.openapi(routes.jsonExtraction, handlers.jsonExtraction);
router.openapi(routes.content, handlers.content);
router.openapi(routes.scrape, handlers.scrape);
router.openapi(routes.links, handlers.links);
router.openapi(routes.search, handlers.search);
router.openapi(routes.pdf, handlers.pdf);

export default router;
