import { Scalar } from '@scalar/hono-api-reference';

import type { AppOpenAPI } from './types';

import packageJSON from '../../package.json';

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: packageJSON.version,
      title: 'WebLinq API',
      description: 'WebLinq API for web scraping, search, and content extraction',
    },
    servers: [
      {
        url: 'https://api.weblinq.dev',
        description: 'Production API Server',
      },
      {
        url: 'http://localhost:8787',
        description: 'Local Development Server',
      },
    ],
  });

  // Register Bearer authentication security scheme
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Enter your API token or session token',
  });

  app.get(
    '/reference',
    Scalar({
      theme: 'kepler',
      url: '/doc',
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'fetch',
      },
      authentication: {
        preferredSecurityScheme: 'bearerAuth',
      },
      metaData: {
        title: 'WebLinq API Reference',
        description: 'Interactive API documentation for WebLinq',
      },
    }),
  );
}
