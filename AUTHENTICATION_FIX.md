# Complete Guide: Making API Keys Work with Cross-Origin Authentication

## 📚 For Students New to CORS and Better Auth

This guide explains how we built a working API key management system with a Next.js frontend (localhost:3000) and Hono backend (localhost:8787). If you're new to web development, this will teach you about cross-origin requests, authentication, and API design.

## 🎯 What We're Building

**Frontend (Next.js)**: A dashboard where users can create, view, and delete API keys
**Backend (Hono)**: API endpoints that handle authentication and API key operations
**Authentication**: Better Auth library handling both session cookies and API keys

## 🚨 Problems We Encountered & Solutions

### Problem 1: 401 Unauthorized Errors (CORS & Cookies)

**What happened**: The frontend could authenticate fine, but API key operations returned 401 errors.

**Why it happened**:

- Frontend runs on `localhost:3000`
- Backend runs on `localhost:8787`
- These are different "origins" (different ports = different origins)
- Browsers block cross-origin requests by default for security
- Session cookies weren't being sent to the backend

**What is CORS?**
CORS (Cross-Origin Resource Sharing) is a security feature that browsers use to block requests between different domains/ports unless the server explicitly allows them.

### Problem 2: API Response Format Mismatch

**What happened**: Frontend got "Cannot read properties of undefined (reading 'length')" errors.

**Why it happened**: Backend returned raw data, but frontend expected a specific format with `{ apiKeys: [...], total: number }`

## 🔧 Complete Solution Breakdown

### 1. Backend Cookie Configuration (`backend/src/lib/auth.ts`)

**Problem**: Cookies with `secure: true` don't work on localhost (non-HTTPS)

```typescript
// ❌ Before: Always secure cookies (breaks localhost)
advanced: {
  defaultCookieAttributes: {
    sameSite: 'none',
    secure: true,  // This breaks localhost!
  },
}

// ✅ After: Smart cookie config based on environment
const isLocalDevelopment =
  params.baseURL?.includes('localhost') ||
  params.baseURL?.includes('127.0.0.1');

advanced: {
  defaultCookieAttributes: {
    sameSite: isLocalDevelopment ? 'lax' : 'none',
    secure: !isLocalDevelopment, // Only secure in production
    httpOnly: true,
    path: '/',
  },
}
```

**Key Learning**:

- `secure: true` cookies only work over HTTPS
- `sameSite: 'lax'` works for localhost (same-site requests)
- `sameSite: 'none'` needed for production cross-origin

### 2. CORS Middleware Setup (`backend/src/middlewares/auth-cors.ts`)

**Problem**: Missing CORS headers prevented cookie transmission

```typescript
// ✅ CORS configuration that works for development
export default function createAuthCors(c: Context<AppBindings>) {
  const isDevelopment =
    c.env.NODE_ENV === 'development' ||
    c.env.NODE_ENV === 'preview' ||
    !c.env.NODE_ENV;

  const frontendUrl = isDevelopment
    ? 'http://localhost:3000'
    : c.env.FRONTEND_URL || 'http://localhost:3000';

  return cors({
    origin: [frontendUrl, 'http://localhost:3000'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie', // ← Essential for receiving cookies
      'Set-Cookie', // ← Essential for setting cookies
    ],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    credentials: true, // ← Essential for cookie transmission
  });
}
```

**Key Learning**:

- `credentials: true` allows cookies in cross-origin requests
- Must explicitly allow `Cookie` and `Set-Cookie` headers
- `origin` must match the frontend URL exactly

### 3. Apply CORS to ALL Relevant Routes (`backend/src/lib/create-app.ts`)

**Problem**: CORS was only applied to `/api/auth/*` but not `/api-keys/*`

```typescript
// ✅ Apply CORS to both auth and API key routes
// CORS for authentication routes
app.use('/api/auth/*', (c: any, next: any) => {
  const authCors = createAuthCors(c);
  return authCors(c, next);
});

// CORS for API key routes - THIS WAS MISSING!
app.use('/api-keys/*', (c: any, next: any) => {
  const authCors = createAuthCors(c);
  return authCors(c, next);
});
```

**Key Learning**: Every route that needs cookies must have CORS configured

### 4. Frontend Auth Client Configuration (`frontend/src/lib/auth-client.ts`)

**Problem**: Missing `baseURL` meant auth client didn't know where to send requests

```typescript
// ✅ Explicit baseURL configuration
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',
});
```

### 5. Frontend API Request Configuration (`frontend/src/lib/api-keys.ts`)

**Problem**: Fetch requests didn't include cookies or proper CORS settings

```typescript
// ✅ Properly configured fetch for cross-origin auth
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

**Key Learning**:

- `credentials: 'include'` sends cookies with the request
- `mode: 'cors'` enables cross-origin requests

### 6. Backend API Response Format (`backend/src/routes/api-keys/api-keys.handlers.ts`)

**Problem**: Backend returned raw data, frontend expected structured format

```typescript
// ❌ Before: Raw response (caused frontend errors)
const result = await auth.api.listApiKeys({ headers: c.req.header() });
return c.json(result, HttpStatusCodes.OK);

// ✅ After: Properly formatted response
const result = await auth.api.listApiKeys({ headers: c.req.header() });
const apiKeys = Array.isArray(result) ? result : [];

return c.json(
  {
    apiKeys,
    total: apiKeys.length,
  },
  HttpStatusCodes.OK
);
```

### 7. Frontend Defensive Programming (`frontend/src/components/dashboard/ApiKeyManager.tsx`)

**Problem**: Frontend crashed when API response was unexpected

```typescript
// ✅ Defensive programming with fallbacks
const loadApiKeys = async () => {
  try {
    const response = await apiKeyService.listApiKeys();
    // Always ensure apiKeys is an array
    const apiKeys = Array.isArray(response?.apiKeys) ? response.apiKeys : [];
    setApiKeys(apiKeys);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load API keys');
    setApiKeys([]); // Keep as empty array on error
  }
};

// Safe rendering with null checks
{
  !apiKeys || apiKeys.length === 0 ? (
    <div>No API keys found</div>
  ) : (
    (apiKeys || []).map((apiKey) => {
      /* render key */
    })
  );
}
```

## 🌐 Environment Variables Required

```bash
# Backend (.env or .dev.vars)
FRONTEND_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:8787
NODE_ENV=development

# Frontend (.env.local)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8787
```

## 🧪 How to Test Everything Works

1. **Start Backend**: `cd backend && npm run dev`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Login**: Go to http://localhost:3000/login and sign in
4. **Dashboard**: Navigate to http://localhost:3000/dashboard
5. **Create API Key**: Click "Create New Key" - should work without 401 errors
6. **View Keys**: List should load without "undefined length" errors

## 🎓 Key Concepts Learned

### What is Better Auth?

Better Auth is a library that handles authentication in modern web apps. It supports:

- Session cookies (for browsers)
- API keys (for programmatic access)
- Multiple authentication providers (GitHub, email/password, etc.)

### What is Cross-Origin Authentication?

When your frontend and backend run on different domains/ports:

- Browsers block requests by default (CORS policy)
- Cookies don't get sent automatically
- You need explicit configuration to allow cross-origin requests

### Cookie Security Levels

- **Development**: `secure: false, sameSite: 'lax'` (works with HTTP localhost)
- **Production**: `secure: true, sameSite: 'none'` (requires HTTPS, allows cross-domain)

### CORS Headers You Need

- `credentials: true` - Allows cookies
- `origin: [allowed-domains]` - Specifies which domains can make requests
- `allowHeaders: ['Cookie', 'Set-Cookie']` - Allows cookie headers

## 🚀 Production Deployment Notes

For production, ensure:

- Use HTTPS (required for `secure: true` cookies)
- Set `sameSite: 'none'` for cross-domain cookies
- Configure proper `trustedOrigins` in Better Auth
- Remove debug logging
- Use environment-specific URLs

## 🎉 Final Result

✅ **Authentication**: Works across localhost:3000 ↔ localhost:8787
✅ **API Keys**: Create, list, delete operations work perfectly
✅ **Error Handling**: Graceful fallbacks prevent crashes
✅ **Security**: Proper CORS and cookie configuration
✅ **Type Safety**: Defensive programming prevents runtime errors

This solution demonstrates how to build a production-ready authentication system with cross-origin support, proper error handling, and security best practices!
