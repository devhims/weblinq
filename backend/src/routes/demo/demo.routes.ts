import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createRoute } from '@hono/zod-openapi';

const tags = ['Demo'];

// Demo Route for Testing Auth Endpoints
export const authDemo = createRoute({
  path: '/demo',
  method: 'get',
  tags,
  summary: 'Authentication demo page',
  description: 'HTML page for testing authentication endpoints in the browser',
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'Demo page HTML',
      content: {
        'text/html': {
          schema: {
            type: 'string',
          },
        },
      },
    },
  },
});

// Demo Route for Testing API Key Endpoints
export const apiKeyDemo = createRoute({
  path: '/demo/api-keys',
  method: 'get',
  tags,
  summary: 'API Key demo page',
  description: 'HTML page for testing API key endpoints in the browser',
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'Demo page HTML',
      content: {
        'text/html': {
          schema: {
            type: 'string',
          },
        },
      },
    },
  },
});

export type AuthDemoRoute = typeof authDemo;
export type ApiKeyDemoRoute = typeof apiKeyDemo;
