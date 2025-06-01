# Production Cookie Authentication Fix

## 🚨 The Problem

**Issue**: Frontend authentication works perfectly, but backend API routes trigger "unauthorized" errors in production.

**Root Cause**: In production (HTTPS), browsers automatically prefix secure cookies with `__Secure-`, but Better Auth's session validation expects the standard cookie name.

### Development vs Production Cookie Behavior

| Environment        | Cookie Name                          | Works? |
| ------------------ | ------------------------------------ | ------ |
| Development (HTTP) | `better-auth.session_token`          | ✅ YES |
| Production (HTTPS) | `__Secure-better-auth.session_token` | ❌ NO  |

## 🔍 Why This Happens

1. **Frontend sets session cookie** → Cookie created with `secure: true` in production
2. **Browser adds `__Secure-` prefix** → Automatic security enhancement for HTTPS
3. **Backend middleware calls `auth.api.getSession()`** → Looks for `better-auth.session_token`
4. **Cookie not found** → Session validation fails
5. **API routes return 401 Unauthorized** → User appears logged out on backend

## ✅ The Solution

Modified `backend/src/middlewares/unified-auth.ts` to include cookie normalization:

### Key Changes

1. **Cookie Normalization Function**: Detects `__Secure-` prefixed cookies and creates standard versions
2. **Header Manipulation**: Creates a normalized headers object for Better Auth
3. **Backward Compatibility**: Maintains existing functionality for development

### Implementation Details

```typescript
function normalizeCookiesForProduction(
  cookieHeader: string | undefined
): string | undefined {
  if (!cookieHeader) return cookieHeader;

  const cookies = cookieHeader.split('; ');
  const normalizedCookies: string[] = [...cookies];

  // Look for secure-prefixed Better Auth session cookies
  cookies.forEach((cookie) => {
    if (cookie.startsWith('__Secure-better-auth.session_token=')) {
      // Add the standard cookie name version for Better Auth compatibility
      const value = cookie.replace('__Secure-better-auth.session_token=', '');
      normalizedCookies.push(`better-auth.session_token=${value}`);
    }
    // Handle any other secure-prefixed Better Auth cookies
    if (cookie.startsWith('__Secure-better-auth.')) {
      const standardName = cookie.replace('__Secure-', '');
      if (
        !cookies.some((c) => c.startsWith(standardName.split('=')[0] + '='))
      ) {
        normalizedCookies.push(standardName);
      }
    }
  });

  return normalizedCookies.join('; ');
}
```

### Modified Middleware Logic

```typescript
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  try {
    // Get original cookie header
    const originalCookieHeader = c.req.header('cookie');

    // Normalize cookies to handle secure prefixes in production
    const normalizedCookieHeader =
      normalizeCookiesForProduction(originalCookieHeader);

    // Create normalized headers for Better Auth
    const normalizedHeaders = new Headers(c.req.raw.headers);
    if (
      normalizedCookieHeader &&
      normalizedCookieHeader !== originalCookieHeader
    ) {
      normalizedHeaders.set('cookie', normalizedCookieHeader);
    }

    // Use normalized headers for session validation
    let session = await auth.api.getSession({
      headers: normalizedHeaders,
    });

    // Rest of authentication logic...
  } catch (error) {
    console.error('UnifiedAuth error:', error);
    // Error handling...
  }

  await next();
};
```

## 🎯 How It Works

1. **Detects Secure Cookies**: Identifies `__Secure-better-auth.session_token` in production
2. **Creates Standard Version**: Adds `better-auth.session_token` to the cookie header
3. **Passes to Better Auth**: Session validation works with the expected cookie name
4. **Maintains Security**: Original secure cookie remains untouched
5. **Backward Compatible**: No impact on development environment

## 🚀 Benefits

- ✅ **Production Ready**: Handles HTTPS cookie security automatically
- ✅ **Zero Breaking Changes**: Works in both development and production
- ✅ **Better Auth Compatible**: Uses standard Better Auth session validation
- ✅ **Security Maintained**: Doesn't compromise cookie security
- ✅ **Debug Friendly**: Enhanced logging for troubleshooting

## 🔧 Testing the Fix

### Before Deployment

```bash
# Development should continue working
curl -X GET http://localhost:8787/api-keys \
  -H "Cookie: better-auth.session_token=your-dev-token"
```

### After Deployment

```bash
# Production should now work with secure cookies
curl -X GET https://your-api.domain.com/api-keys \
  -H "Cookie: __Secure-better-auth.session_token=your-prod-token"
```

### Debug Logs to Watch For

```
Found secure-prefixed session cookie, adding standard version for Better Auth compatibility
UnifiedAuth debug: {
  cookiesModified: true,
  originalCookies: "__Secure-better-auth.session_token=...",
  normalizedCookies: "__Secure-better-auth.session_token=...; better-auth.session_token=..."
}
Auth successful for user: user@example.com (source: backend)
```

## 📋 Deployment Checklist

- [ ] Deploy updated `unified-auth.ts` middleware
- [ ] Monitor backend logs for cookie normalization messages
- [ ] Test API key operations in production
- [ ] Verify dashboard functionality remains intact
- [ ] Confirm no authentication regressions

## 🛠 Alternative Solutions Considered

1. **Frontend Cookie Name Override**: Would break Better Auth standards
2. **Backend Cookie Parser Modification**: Too invasive and framework-dependent
3. **Proxy Cookie Rewriting**: Complex infrastructure change
4. **Token-Based Workaround**: Would require significant architecture changes

**Chosen Solution**: Cookie normalization middleware - minimal, effective, and maintainable.

## 🎉 Expected Outcome

After deployment:

- ✅ Users can login on frontend
- ✅ Dashboard loads properly
- ✅ API key operations work seamlessly
- ✅ Backend routes authenticate successfully
- ✅ Production security maintained
- ✅ Development workflow unchanged

This fix resolves the production authentication issue while maintaining security and compatibility across all environments.
