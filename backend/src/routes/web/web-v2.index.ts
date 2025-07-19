import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlersV2 from './web-v2.handlers';
import * as routesV2 from './web-v2.routes';

const router = createRouter();

// Apply requireAuth middleware to all V2 web routes
// This ensures all V2 web operations require authentication
router.use('/web', requireAuth);
router.use('/web/*', requireAuth);

// V2 routes using PlaywrightPoolDO with caching
router.openapi(routesV2.markdownV2, handlersV2.markdownV2);
router.openapi(routesV2.screenshotV2, handlersV2.screenshotV2);
router.openapi(routesV2.jsonExtractionV2, handlersV2.jsonExtractionV2);
router.openapi(routesV2.linksV2, handlersV2.linksV2);
router.openapi(routesV2.contentV2, handlersV2.contentV2);
router.openapi(routesV2.pdfV2, handlersV2.pdfV2);
router.openapi(routesV2.scrapeV2, handlersV2.scrapeV2);
router.openapi(routesV2.searchV2, handlersV2.searchV2);

export default router;
