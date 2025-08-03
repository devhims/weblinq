import { createRouter } from '@/lib/create-app';
import { requireAdmin } from '@/middlewares/unified-auth';

import * as handlers from './system.handlers';
import * as routes from './system.routes';

const router = createRouter();

// Apply admin privileges to all system routes
// System operations are critical infrastructure management that require admin access
// requireAdmin automatically handles authentication checking as well
router.use('/system', requireAdmin);
router.use('/system/*', requireAdmin);

// Mount all routes using regular HTTP methods instead of OpenAPI methods
// This keeps the routes functional but hides them from the OpenAPI documentation
router.post('/system/browser-status', handlers.browserStatus);
router.post('/system/session-health', handlers.sessionHealth);
router.post('/system/create-browsers', handlers.createBrowsers);
router.post('/system/cleanup-do', handlers.cleanupDo);
router.post('/system/delete-all-browsers', handlers.deleteAllBrowsers);
router.post('/system/check-remaining', handlers.checkRemaining);
router.post('/system/close-browser-session', handlers.closeBrowserSession);
router.openapi(routes.updateUserPlan, handlers.updateUserPlan);

export default router;
