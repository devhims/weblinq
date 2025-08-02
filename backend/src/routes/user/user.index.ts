import { createRouter } from '@/lib/create-app';
import { requireAdmin, requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './user.handlers';
import * as routes from './user.routes';

const router = createRouter();

// Public routes (no auth required)
const publicRouter = createRouter();
publicRouter.openapi(routes.verifyEmail, handlers.verifyEmail);
publicRouter.openapi(routes.verifyEmailToken, handlers.verifyEmailToken);

// Protected routes requiring authentication
const protectedRouter = createRouter();
protectedRouter.use(requireAuth);
protectedRouter.openapi(routes.getMe, handlers.getMe);
protectedRouter.openapi(routes.getCredits, handlers.getCredits);
protectedRouter.openapi(routes.clearCache, handlers.clearCache);

// Admin-only routes requiring admin privileges
const adminRouter = createRouter();
adminRouter.use(requireAdmin);
adminRouter.openapi(routes.initializeUser, handlers.initializeUser);
adminRouter.openapi(routes.bootstrapCredits, handlers.bootstrapCredits);

// Mount all routers on the main router
router.route('/user', publicRouter);
router.route('/user', protectedRouter);
router.route('/user', adminRouter);

export default router;
