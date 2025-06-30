import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './system.handlers';
import * as routes from './system.routes';

const router = createRouter();

// Apply requireAuth middleware to all system routes
// This ensures all system operations require authentication
router.use('/system', requireAuth);
router.use('/system/*', requireAuth);

// Mount all routes
router.openapi(routes.browserStatus, handlers.browserStatus);
router.openapi(routes.sessionHealth, handlers.sessionHealth);
router.openapi(routes.createBrowsers, handlers.createBrowsers);
router.openapi(routes.cleanupDo, handlers.cleanupDo);
router.openapi(routes.deleteAllBrowsers, handlers.deleteAllBrowsers);

export default router;
