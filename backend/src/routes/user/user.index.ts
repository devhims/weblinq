import { createRouter } from '@/lib/create-app';

import * as handlers from './user.handlers';
import * as routes from './user.routes';

const router = createRouter();
const userRouter = createRouter();

userRouter.openapi(routes.getMe, handlers.getMe);

userRouter.openapi(routes.getCredits, handlers.getCredits);

userRouter.openapi(routes.bootstrapCredits, handlers.bootstrapCredits);

userRouter.openapi(routes.verifyEmail, handlers.verifyEmail);

userRouter.openapi(routes.verifyEmailToken, handlers.verifyEmailToken);

router.route('/user', userRouter);

export default router;
