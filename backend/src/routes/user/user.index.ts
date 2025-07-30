import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './user.handlers';
import * as routes from './user.routes';

const router = createRouter();

// Public routes (no auth required) - mounted directly on main router
const publicRouter = createRouter();
publicRouter.openapi(routes.verifyEmail, handlers.verifyEmail);
publicRouter.openapi(routes.verifyEmailToken, handlers.verifyEmailToken);
publicRouter.openapi(routes.initializeUser, handlers.initializeUser);

// Protected routes requiring authentication
const protectedRouter = createRouter();
protectedRouter.use(requireAuth);
protectedRouter.openapi(routes.getMe, handlers.getMe);
protectedRouter.openapi(routes.getCredits, handlers.getCredits);
protectedRouter.openapi(routes.bootstrapCredits, handlers.bootstrapCredits);
protectedRouter.openapi(routes.clearCache, handlers.clearCache);

// Mount both routers on the main router
router.route('/user', publicRouter);
router.route('/user', protectedRouter);

export default router;
