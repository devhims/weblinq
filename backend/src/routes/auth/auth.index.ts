import { createRouter } from '@/lib/create-app';

import * as handlers from './auth.handlers';
import * as routes from './auth.routes';

const router = createRouter();

// Create a sub-router for /auth routes
const authRouter = createRouter();

// GitHub OAuth routes
authRouter.openapi(routes.githubSignIn, handlers.githubSignIn);
authRouter.openapi(routes.githubCallback, handlers.githubCallback);

// Email/Password authentication routes
authRouter.openapi(routes.emailSignIn, handlers.emailSignIn);
authRouter.openapi(routes.emailSignUp, handlers.emailSignUp);

// Session management routes
authRouter.openapi(routes.signOut, handlers.signOut);
authRouter.openapi(routes.getSession, handlers.getSession);

// Mount the auth router under /auth prefix
router.route('/auth', authRouter);

export default router;
