# Authentication Fix for Local Development

## Problem Summary

The API key management feature is failing with 401 unauthorized errors when running locally (frontend on localhost:3000, backend on localhost:8787). This is due to cross-origin authentication issues between the Next.js frontend and Hono backend.

## Root Causes

1. **Secure Cookie Issue**: Backend auth config has `secure: true` which doesn't work for localhost (non-HTTPS)
2. **CORS Configuration**: Missing CORS headers for `/api-keys/*` routes
3. **Cookie SameSite Policy**: Wrong `sameSite` setting for local development
4. **Auth Client Configuration**: Frontend auth client missing `baseURL` configuration

## Fixes Applied

### 1. Backend Auth Configuration (`backend/src/lib/auth.ts`)

**Issue**: Secure cookies and wrong SameSite policy for localhost

**Fix**: Added conditional cookie configuration for local development:

```typescript
// Detect if we're running in local development
const isLocalDevelopment = params.baseURL?.includes('localhost')
  || params.baseURL?.includes('127.0.0.1');

// Configure cookies for cross-domain requests
advanced: {
  defaultCookieAttributes: {
    sameSite: isLocalDevelopment ? 'lax' : 'none',
    secure: !isLocalDevelopment, // Only secure in production
    partitioned: false,
    domain: isLocalDevelopment ? undefined : undefined,
    httpOnly: true,
    path: '/',
  },
}
```

### 2. CORS Configuration (`backend/src/middlewares/auth-cors.ts`)

**Issue**: Only checking for `NODE_ENV === 'preview'` instead of development

**Fix**: Updated environment detection:

```typescript
// Check if we're in development environment
const isDevelopment =
  c.env.NODE_ENV === 'development' ||
  c.env.NODE_ENV === 'preview' ||
  !c.env.NODE_ENV;

// Get the frontend URL from environment or default to localhost for development
const frontendUrl = isDevelopment
  ? 'http://localhost:3000'
  : c.env.FRONTEND_URL || 'http://localhost:3000';

return cors({
  origin: [frontendUrl, 'http://localhost:3000'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Cookie',
    'Set-Cookie',
  ],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  exposeHeaders: ['Content-Length', 'Set-Cookie'],
  maxAge: 600,
  credentials: true,
});
```

### 3. Frontend Auth Client (`frontend/src/lib/auth-client.ts`)

**Issue**: Missing baseURL configuration for cross-origin auth

**Fix**: Added explicit baseURL:

```typescript
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',
});
```

### 4. API Service Enhancement (`frontend/src/lib/api-keys.ts`)

**Issue**: Missing explicit CORS mode and accept headers

**Fix**: Enhanced fetch configuration:

```typescript
const response = await fetch(url, {
  ...options,
  credentials: 'include', // Include cookies for session-based auth
  mode: 'cors', // Explicitly set CORS mode
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  },
});
```

### 5. Backend App Configuration (`backend/src/lib/create-app.ts`)

**Issue**: Missing CORS for `/api-keys/*` routes

**Fix**: Added CORS middleware for API key routes:

```typescript
// CORS middleware for API key routes to allow frontend access
app.use('/api-keys/*', (c, next) => {
  const authCors = createAuthCors(c);
  return authCors(c, next);
});
```

## Environment Variables Required

Make sure these environment variables are set in your backend:

```bash
# Backend (.env or .dev.vars)
FRONTEND_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:8787
NODE_ENV=development

# Frontend (.env.local)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8787
```

## Testing Steps

1. **Start Backend**: `cd backend && npm run dev`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Login**: Go to http://localhost:3000/login and sign in
4. **Dashboard**: Navigate to http://localhost:3000/dashboard
5. **Create API Key**: Click "Create New Key" and test the functionality

## Debugging

Added debug logging to `unified-auth.ts` to help identify authentication issues:

```typescript
console.log('UnifiedAuth debug:', {
  hasAuth: !!auth,
  hasSession: !!session,
  headers: Object.fromEntries(c.req.raw.headers.entries()),
  cookies: c.req.header('cookie'),
  userAgent: c.req.header('user-agent'),
  origin: c.req.header('origin'),
});
```

Check the backend console logs when making API requests to see if:

- Auth instance is available
- Session is being detected
- Cookies are being sent properly
- CORS headers are being set

## Common Issues

1. **Still getting 401?**: Check that cookies are being sent in the request headers
2. **CORS errors?**: Verify `FRONTEND_URL` environment variable matches your frontend URL exactly
3. **No session detected?**: Ensure you're logged in and the session cookie is set
4. **TypeScript errors?**: The auth middleware types may need adjustment - focus on functionality first

## Production Deployment

For production, ensure:

- `secure: true` for HTTPS
- `sameSite: 'none'` for cross-origin
- Proper `trustedOrigins` configuration
- Remove debug logging
