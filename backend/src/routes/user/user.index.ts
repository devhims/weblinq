import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares';

import * as handlers from './user.handlers';
import * as routes from './user.routes';

const router = createRouter();

// Public endpoint - works with or without authentication
router.openapi(routes.getMe, handlers.getMe);

// Apply auth middleware to protected routes
router.use('/profile', requireAuth);

// Protected endpoint - requires authentication
router.openapi(routes.getProfile, handlers.getProfile);

export default router;
