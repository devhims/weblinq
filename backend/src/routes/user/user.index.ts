import { createRouter } from '@/lib/create-app';

import * as handlers from './user.handlers';
import * as routes from './user.routes';

const router = createRouter();

// User info endpoint - works with or without authentication
// Provides different information based on authentication status
router.openapi(routes.getMe, handlers.getMe);

export default router;
