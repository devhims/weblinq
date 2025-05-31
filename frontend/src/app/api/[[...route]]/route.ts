import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { config } from '@/config/env';

export const runtime = 'nodejs';

const app = new Hono().basePath('/api');

// Catch-all route that proxies to backend
app.all('*', async (c) => {
  try {
    // Get the original path without the /api prefix since backend expects /api/...
    const path = c.req.path; // This already includes /api from basePath
    const url = new URL(c.req.url);
    const backendUrl = `${config.backendUrl}${path}${url.search}`;

    // Get headers from the request
    const requestHeaders: Record<string, string> = {};
    c.req.header(); // This returns all headers as an object
    Object.entries(c.req.header()).forEach(([key, value]) => {
      if (typeof value === 'string') {
        requestHeaders[key] = value;
      }
    });

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: c.req.method,
      headers: {
        ...requestHeaders,
        // Add forwarding headers
        'x-forwarded-host': c.req.header('host') || '',
        'x-forwarded-proto': c.req.header('x-forwarded-proto') || 'http',
      },
      body: ['GET', 'HEAD'].includes(c.req.method)
        ? null
        : await c.req.arrayBuffer(),
    });

    // Forward the response
    const responseBody = await response.arrayBuffer();

    // Set response headers, filtering out problematic ones
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (
        !['connection', 'transfer-encoding', 'content-encoding'].includes(
          key.toLowerCase()
        )
      ) {
        headers[key] = value;
      }
    });

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('Error forwarding request to backend:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Export handlers using Hono's handle function
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
