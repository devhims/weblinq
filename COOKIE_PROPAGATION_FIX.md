# Cookie Propagation Fix: Frontend Auth ↔ Backend API Authentication

## 🚨 The Core Problem

**Frontend auth login works** (Safari + incognito fixed ✅), but **backend API calls fail** with:

```
"Authentication required. Please provide a valid session cookie or API key."
```

## 🔍 Root Cause Analysis

You have **two separate auth systems** that aren't sharing session data:

1. **Frontend Auth** (`/api/auth/*`) → Creates session cookies for `localhost:3000`
2. **Backend Auth** (`localhost:8787`) → Can't read frontend session cookies

### The Fundamental Issue:

- User logs in via **frontend auth** → Session stored in frontend auth system
- User tries to access API keys → **Backend auth** looks for session but can't find it
- Backend rejects request even though user is authenticated

## 🎯 Solution Options

### Option 1: Session Bridge (Recommended)

Create a bridge that allows the backend to validate frontend sessions.

### Option 2: Unified Auth (Complex)

Move all authentication to the backend and make frontend proxy requests.

### Option 3: Token-Based (Alternative)

Use JWT tokens instead of session cookies for backend communication.

## ✅ Implementing Option 1: Session Bridge

### 1. **Backend Session Validation Enhancement**

Update the unified auth middleware to check both backend and frontend sessions:

```typescript
// backend/src/middlewares/unified-auth.ts
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  try {
    // First, try backend session validation
    let session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    // If no backend session, try to validate frontend session
    if (!session) {
      session = await validateFrontendSession(c);
    }

    console.log('UnifiedAuth debug:', {
      hasAuth: !!auth,
      hasSession: !!session,
      sessionSource: session ? 'backend' : 'none',
      cookies: c.req.header('cookie'),
    });

    if (session) {
      c.set('user', session.user);
      c.set('session', session.session);
      console.log('Auth successful for user:', session.user.email);
    } else {
      c.set('user', null);
      c.set('session', null);
      console.log('No valid session found');
    }
  } catch (error) {
    console.error('UnifiedAuth error:', error);
    c.set('user', null);
    c.set('session', null);
  }

  await next();
};

// Helper function to validate frontend session
async function validateFrontendSession(c: Context<AppBindings>) {
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:3000';
  const cookies = c.req.header('cookie');

  if (!cookies) return null;

  try {
    // Make request to frontend's session endpoint
    const response = await fetch(`${frontendUrl}/api/auth/session`, {
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) return null;

    const sessionData = await response.json();

    // If frontend session is valid, return in backend format
    if (sessionData?.user) {
      return {
        user: sessionData.user,
        session: sessionData.session || { id: 'frontend-session' },
      };
    }

    return null;
  } catch (error) {
    console.error('Frontend session validation failed:', error);
    return null;
  }
}
```

### 2. **Frontend Session Endpoint Enhancement**

Ensure your frontend session endpoint returns proper data:

```typescript
// frontend/src/app/api/auth/session/route.ts (if doesn't exist, create it)
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return Response.json({
      user: session?.user || null,
      session: session?.session || null,
      isAuthenticated: !!session?.user,
    });
  } catch (error) {
    console.error('Session check failed:', error);
    return Response.json({
      user: null,
      session: null,
      isAuthenticated: false,
    });
  }
}
```

### 3. **Backend CORS Configuration**

Ensure the backend can make requests to the frontend:

```typescript
// backend/src/middlewares/auth-cors.ts (already updated)
allowHeaders: [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Cookie',            // CRITICAL: Allow session cookies from frontend
  'Set-Cookie',        // CRITICAL: Allow setting auth cookies
  'Accept',
  'Origin',
  'User-Agent',
  'Cache-Control',
],
exposeHeaders: [
  'Content-Length',
  'Set-Cookie',        // CRITICAL: Expose auth cookies to frontend
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Credentials',
],
credentials: true, // CRITICAL: Allow cookies for session authentication
```

## 🧪 Testing the Fix

### 1. **Login Flow Test**

```bash
1. Login via frontend → ✅ Should work (already fixed)
2. Navigate to dashboard → ✅ Should stay logged in
3. Try to create API key → ✅ Should work (after fix)
```

### 2. **Cookie Validation Test**

```bash
# Check if cookies are being sent:
1. Open browser dev tools
2. Navigate to dashboard
3. Try to create API key
4. Check Network tab → Headers → Request → Cookie
5. Should see session cookies being sent to backend
```

### 3. **Session Bridge Test**

```bash
# Check if backend can validate frontend session:
1. Add console.log to unified auth middleware
2. Watch backend logs when making API key requests
3. Should see "Auth successful for user: [email]"
```

## 🔧 Alternative: Quick Token-Based Fix

If the session bridge is too complex, implement a simple token approach:

### 1. **Create Session Token Endpoint**

```typescript
// frontend/src/app/api/auth/token/route.ts
import { auth } from '@/lib/auth';
import { sign } from 'jsonwebtoken';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Create a short-lived token for backend API access
  const token = sign(
    {
      userId: session.user.id,
      email: session.user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 15, // 15 minutes
    },
    process.env.JWT_SECRET!
  );

  return Response.json({ token });
}
```

### 2. **Update API Service to Use Tokens**

```typescript
// frontend/src/lib/api-keys.ts
async function makeAuthenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get session token from frontend
  const tokenResponse = await fetch('/api/auth/token', {
    credentials: 'include',
  });

  let headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  };

  if (tokenResponse.ok) {
    const { token } = await tokenResponse.json();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = getBackendUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    mode: 'cors',
    headers,
  });

  // ... rest of function
}
```

## 🎯 Recommended Approach

**Use Option 1 (Session Bridge)** because:

- ✅ Maintains cookie-based authentication security
- ✅ No need for JWT complexity
- ✅ Works with existing Better Auth setup
- ✅ Preserves session management features

## 🚀 Action Items

1. **Implement session bridge** in unified auth middleware
2. **Test login → API key flow** in all browsers
3. **Add debugging logs** to track session validation
4. **Monitor backend logs** for authentication success/failure

This fix ensures that users authenticated via frontend auth can successfully access backend API endpoints! 🎯
