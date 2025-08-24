import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './web-2.handlers';
import * as routes from './web-2.routes';

const router = createRouter();

// Apply requireAuth middleware to all web-2 routes
// This ensures all web operations require authentication
router.use('/web', requireAuth);
router.use('/web/*', requireAuth);

// Mount the search route using Durable Object handler
router.openapi(routes.search, handlers.search);

export default router;
