import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './system.handlers';

const router = createRouter();

// Apply requireAuth middleware to all system routes
// This ensures all system operations require authentication
router.use('/system', requireAuth);
router.use('/system/*', requireAuth);

// Mount all routes using regular HTTP methods instead of OpenAPI methods
// This keeps the routes functional but hides them from the OpenAPI documentation
router.post('/system/browser-status', handlers.browserStatus);
router.post('/system/session-health', handlers.sessionHealth);
router.post('/system/create-browsers', handlers.createBrowsers);
router.post('/system/cleanup-do', handlers.cleanupDo);
router.post('/system/delete-all-browsers', handlers.deleteAllBrowsers);
router.post('/system/check-remaining', handlers.checkRemaining);
router.post('/system/close-browser-session', handlers.closeBrowserSession);

export default router;
