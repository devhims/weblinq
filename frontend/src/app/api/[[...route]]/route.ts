import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { config } from '@/config/env';

export const runtime = 'nodejs';

const app = new Hono().basePath('/api');

// Catch-all route that proxies to backend
app.all('*', async (c) => {
  try {
    const path = c.req.path;
    const url = new URL(c.req.url);
    const backendUrl = `${config.backendUrl}${path}${url.search}`;

    // Forward headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(c.req.header())) {
      if (typeof value === 'string') {
        headers.set(key, value);
      }
    }

    // Handle request body
    let body = null;
    if (!['GET', 'HEAD'].includes(c.req.method)) {
      body = await c.req.arrayBuffer();
    }

    // Make the request
    const response = await fetch(backendUrl, {
      method: c.req.method,
      headers,
      body,
      redirect: 'manual',
    });

    // Simply return the response directly without modification
    return response;
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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
