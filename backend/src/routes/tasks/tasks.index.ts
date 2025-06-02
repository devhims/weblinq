import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as durableHandlers from './tasks.durable-handlers';
import * as routes from './tasks.routes';

const router = createRouter();

// Apply requireAuth middleware only to task-specific routes
// This way it won't affect other routes when mounted at root
router.use('/tasks', requireAuth);
router.use('/tasks/*', requireAuth);

// Mount task routes using Durable Object handlers
router.openapi(routes.list, durableHandlers.list);
router.openapi(routes.create, durableHandlers.create);
router.openapi(routes.getOne, durableHandlers.getOne);
router.openapi(routes.patch, durableHandlers.patch);
router.openapi(routes.remove, durableHandlers.remove);

export default router;
