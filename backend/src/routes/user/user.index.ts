import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './user.handlers';
import * as routes from './user.routes';

const router = createRouter();
const userRouter = createRouter();

userRouter.openapi(routes.getMe, handlers.getMe);

// Protected routes requiring authentication
userRouter.use(requireAuth);
userRouter.openapi(routes.getCredits, handlers.getCredits);
userRouter.openapi(routes.bootstrapCredits, handlers.bootstrapCredits);
userRouter.openapi(routes.clearCache, handlers.clearCache);

// Public routes (no auth required)
const publicRouter = createRouter();
publicRouter.openapi(routes.verifyEmail, handlers.verifyEmail);
publicRouter.openapi(routes.verifyEmailToken, handlers.verifyEmailToken);

userRouter.route('/', publicRouter);

router.route('/user', userRouter);

export default router;
