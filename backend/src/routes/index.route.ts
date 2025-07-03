import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createRouter } from '@/lib/create-app';
import { createStandardSuccessResponse } from '@/lib/response-utils';

const router = createRouter();

// Index route - hidden from OpenAPI documentation
router.get('/', (c) => {
  return c.json(createStandardSuccessResponse({ message: 'Weblinq API Server' }), HttpStatusCodes.OK);
});

export default router;
