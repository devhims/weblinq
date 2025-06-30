import { createRouter } from '@/lib/create-app';
import { requireAuth } from '@/middlewares/unified-auth';

import * as handlers from './files.handlers';
import * as routes from './files.routes';

const router = createRouter();

// Apply requireAuth middleware to all files routes
// This ensures all file operations require authentication
router.use('/files', requireAuth);
router.use('/files/*', requireAuth);

// Mount all routes
router.openapi(routes.listFiles, handlers.listFiles);
router.openapi(routes.deleteFile, handlers.deleteFile);

export default router;
