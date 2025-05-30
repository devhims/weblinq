import { createRouter } from '@/lib/create-app';

import { apiKeyDemoHandler, apiKeyDemoRoute, authDemoHandler, authDemoRoute } from './index';

const router = createRouter();

// Demo route for testing authentication
router.openapi(authDemoRoute, authDemoHandler);

// Demo route for testing API key endpoints
router.openapi(apiKeyDemoRoute, apiKeyDemoHandler);

export default router;
