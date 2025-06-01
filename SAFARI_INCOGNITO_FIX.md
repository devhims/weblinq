# Safari & Incognito Mode Authentication Fix (Corrected Architecture)

## 🏗️ Actual Architecture (Clarified)

```
Frontend:           localhost:3000 (yourapp.com)
Frontend Auth API:  localhost:3000/api/auth/* (yourapp.com/api/auth/*) ← SAME DOMAIN
Backend API:        localhost:8787 (api.yourapp.com) ← DIFFERENT DOMAIN
```

## 🎯 Purpose of Each Auth System

### Frontend Auth (`frontend/src/lib/auth.ts` + `/api/auth/[...all]`)

- ✅ **Email login & OAuth authentication**
- ✅ **Same domain** as frontend (no CORS issues)
- ✅ Uses Next.js API routes at `/api/auth/*`
- ✅ Standard cookie behavior works fine

### Backend Auth (`backend/src/lib/auth.ts`)

- ✅ **API key generation & management**
- ✅ **Securing critical service endpoints**
- ✅ **Different domain** = requires CORS configuration

## 🚨 The Real Problem

The issue was **only with API key operations** (backend auth), not with login/OAuth (frontend auth).

**Chrome Normal Mode**: Allows API key requests to backend despite imperfect CORS
**Safari & Incognito**: Blocks API key requests to backend due to strict CORS policies

## ✅ Correct Solution

### 1. **Frontend Auth Configuration** (frontend/src/lib/auth.ts)

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';

export const auth = betterAuth({
  // NO baseURL needed - uses current domain's /api/auth/* routes
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  // NO advanced cookie config needed - same domain = no CORS issues
});
```

### 2. **Frontend Auth Client** (frontend/src/lib/auth-client.ts)

```typescript
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // NO baseURL needed - defaults to current domain's /api/auth/* routes
  // This handles email login & OAuth authentication on the SAME domain
});
```

### 3. **Backend Auth Configuration** (backend/src/lib/auth.ts) - ⚠️ ONLY THIS NEEDS CORS FIX

```typescript
// ✅ Smart domain detection for API key operations
let cookieDomain: string | undefined = undefined;
if (!isLocalDevelopment && params.frontendUrl) {
  try {
    const url = new URL(params.frontendUrl);
    const backendUrl = new URL(params.baseURL || '');

    const frontendDomain = url.hostname.split('.').slice(-2).join('.');
    const backendDomain = backendUrl.hostname.split('.').slice(-2).join('.');

    if (frontendDomain === backendDomain) {
      cookieDomain = `.${frontendDomain}`;
    }
  } catch (error) {
    console.warn('Could not parse frontend URL for domain extraction:', error);
  }
}

// ✅ Production-ready cookie settings for API key operations
advanced: {
  defaultCookieAttributes: {
    sameSite: isLocalDevelopment ? 'lax' : 'none',
    secure: !isLocalDevelopment,
    partitioned: !isLocalDevelopment,
    domain: cookieDomain,
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}
```

### 4. **CORS Configuration** (backend/src/middlewares/auth-cors.ts) - ⚠️ ONLY FOR BACKEND

```typescript
// ✅ Only needed for backend API key operations
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
      'Cookie',
      'Set-Cookie',
      'Accept',
    ],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    maxAge: 86400,
    credentials: true,
  });
}
```

## 🔄 What Each System Handles

### ✅ Works in All Browsers (Same Domain)

- **Login** → `POST /api/auth/sign-in` (same domain)
- **OAuth** → `GET /api/auth/oauth/github` (same domain)
- **Session** → `GET /api/auth/session` (same domain)

### ❌ Safari/Incognito Issues (Cross Domain)

- **API Keys** → `POST localhost:8787/api-keys/create` (different domain)
- **List Keys** → `GET localhost:8787/api-keys/list` (different domain)

## 🧪 Testing Strategy

### 1. **Login/OAuth Testing** (Should work everywhere)

```bash
✅ Chrome Normal: Login → Success
✅ Chrome Incognito: Login → Success
✅ Safari: Login → Success
✅ Safari Private: Login → Success
```

### 2. **API Key Testing** (After backend CORS fix)

```bash
✅ Chrome Normal: Create API Key → Success
✅ Chrome Incognito: Create API Key → Success (after fix)
✅ Safari: Create API Key → Success (after fix)
✅ Safari Private: Create API Key → Success (after fix)
```

## 🌐 Environment Variables

### Backend (.env or Cloudflare Workers)

```bash
# For API key operations cross-origin
BETTER_AUTH_URL=https://api.yourapp.com
FRONTEND_URL=https://yourapp.com
NODE_ENV=production
```

### Frontend (.env.local)

```bash
# For API service calls to backend (not auth)
NEXT_PUBLIC_BACKEND_URL=https://api.yourapp.com

# Frontend auth uses same domain - no config needed
```

## 🎯 Key Insights

1. **Frontend auth = same domain** → No CORS issues
2. **Backend auth = cross domain** → Requires CORS configuration
3. **Only API key operations** need the Safari/incognito fixes
4. **Login/OAuth already works** in all browsers
5. **Two separate auth systems** with different purposes

## 🚀 Action Items

1. ✅ Keep frontend auth simple (same domain)
2. ✅ Fix backend auth for cross-domain API keys
3. ✅ Test login (should work everywhere)
4. ✅ Test API keys (should work after backend CORS fix)

This clarifies that your CORS issues are specifically with API key management, not with the core authentication flow!
