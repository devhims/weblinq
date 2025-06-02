import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

import { createRouter } from '@/lib/create-app';
import { createRoute } from '@hono/zod-openapi';

const router = createRouter().openapi(
  createRoute({
    tags: ['Index'],
    method: 'get',
    path: '/',
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        createMessageObjectSchema('Weblinq API Server'),
        'Weblinq API Server Index',
      ),
    },
  }),
  (c) => {
    return c.json(
      {
        message: 'Weblinq API Server',
      },
      HttpStatusCodes.OK,
    );
  },
);

export default router;
