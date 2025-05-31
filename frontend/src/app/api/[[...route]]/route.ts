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

    // Get headers from the request, properly handling cookies
    const requestHeaders: Record<string, string> = {};

    // Get all headers from the original request
    for (const [key, value] of Object.entries(c.req.header())) {
      if (typeof value === 'string') {
        requestHeaders[key] = value;
      }
    }

    // Ensure cookies are properly forwarded
    const cookies = c.req.header('cookie');
    if (cookies) {
      requestHeaders['cookie'] = cookies;
    }

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: c.req.method,
      headers: {
        ...requestHeaders,
        // Add forwarding headers
        'x-forwarded-host': c.req.header('host') || '',
        'x-forwarded-proto': c.req.header('x-forwarded-proto') || 'https',
        'x-forwarded-for':
          c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '',
        // Ensure proper origin headers for CORS
        origin: `https://${c.req.header('host')}`,
      },
      // Handle request body properly
      body: ['GET', 'HEAD'].includes(c.req.method)
        ? null
        : await c.req.arrayBuffer(),
      // Important: Don't follow redirects to preserve original response
      redirect: 'manual',
    });

    // Handle different response types properly
    let responseBody: ArrayBuffer | string;
    const contentType = response.headers.get('content-type') || '';

    if (
      contentType.includes('application/json') ||
      contentType.includes('text/')
    ) {
      // For JSON and text responses, handle as text to avoid corruption
      responseBody = await response.text();
    } else {
      // For binary responses, handle as ArrayBuffer
      responseBody = await response.arrayBuffer();
    }

    // Properly forward response headers, especially cookies
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        ![
          'connection',
          'transfer-encoding',
          'content-encoding',
          'content-length',
        ].includes(lowerKey)
      ) {
        responseHeaders[key] = value;
      }
    });

    // Special handling for Set-Cookie headers (can be multiple)
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      // Hono handles multiple Set-Cookie headers automatically
      setCookieHeaders.forEach((cookie) => {
        responseHeaders['set-cookie'] = cookie;
      });
    }

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
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
