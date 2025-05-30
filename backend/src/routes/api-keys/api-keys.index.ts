import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares';

import * as handlers from './api-keys.handlers';
import * as routes from './api-keys.routes';

const router = createRouter();

// Create a sub-router for /api-keys routes
const apiKeysRouter = createRouter();

// Apply authentication to all API key routes
apiKeysRouter.use('*', requireAuth);

// API key management routes (simplified - no update, users create new keys instead)
apiKeysRouter.openapi(routes.createApiKey, handlers.createApiKey);
apiKeysRouter.openapi(routes.listApiKeys, handlers.listApiKeys);
apiKeysRouter.openapi(routes.getApiKey, handlers.getApiKey);
apiKeysRouter.openapi(routes.deleteApiKey, handlers.deleteApiKey);

// Mount the api-keys router under /api-keys prefix
router.route('/api-keys', apiKeysRouter);

export default router;
