import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './tasks.handlers';
import * as routes from './tasks.routes';

const router = createRouter();

// Apply requireAuth middleware only to task-specific routes
// This way it won't affect other routes when mounted at root
router.use('/tasks', requireAuth);
router.use('/tasks/*', requireAuth);

// Mount task routes directly (they already have /tasks paths)
router.openapi(routes.list, handlers.list);
router.openapi(routes.create, handlers.create);
router.openapi(routes.getOne, handlers.getOne);
router.openapi(routes.patch, handlers.patch);
router.openapi(routes.remove, handlers.remove);

export default router;
